import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Logger, Injectable, Inject } from "@nestjs/common";
import { DI_TOKENS } from "../core/di-tokens";
import type {
  IStorageAdapter,
  IDistributedSyncConfig,
} from "../interfaces/shield-config.interface";
import { v4 as uuidv4 } from "uuid";

interface NodeInfo {
  id: string;
  lastHeartbeat: number;
  metadata?: Record<string, any>;
}

interface SyncMessage {
  type: "heartbeat" | "config_update" | "metrics" | "custom";
  nodeId: string;
  timestamp: number;
  data?: any;
}

@Injectable()
export class DistributedSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DistributedSyncService.name);
  private readonly config: IDistributedSyncConfig;
  private readonly nodeId: string;
  private syncInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private nodes: Map<string, NodeInfo> = new Map();
  private pubSubClient?: any;

  constructor(
    @Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly options: any,
    @Inject(DI_TOKENS.SHIELD_STORAGE) private readonly storage: IStorageAdapter,
  ) {
    this.config = this.options.advanced?.distributedSync || { enabled: false, syncInterval: 5000 };
    this.nodeId = this.config.nodeId || uuidv4();
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.logger.log(`Initializing distributed sync for node: ${this.nodeId}`);
    await this.registerNode();
    await this.setupPubSub();
    this.startSyncInterval();
    this.startCleanupInterval();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.logger.log(`Shutting down distributed sync for node: ${this.nodeId}`);

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await this.unregisterNode();
    await this.closePubSub();
  }

  private async registerNode(): Promise<void> {
    const nodeInfo: NodeInfo = {
      id: this.nodeId,
      lastHeartbeat: Date.now(),
      metadata: {
        version: process.version,
        pid: process.pid,
        hostname: process.env.HOSTNAME || "unknown",
      },
    };

    await this.storage.set(`node:${this.nodeId}`, nodeInfo, 60);
    this.nodes.set(this.nodeId, nodeInfo);

    if (this.config.onNodeJoin) {
      this.config.onNodeJoin(this.nodeId);
    }
  }

  private async unregisterNode(): Promise<void> {
    await this.storage.delete(`node:${this.nodeId}`);

    await this.broadcastMessage({
      type: "custom",
      nodeId: this.nodeId,
      timestamp: Date.now(),
      data: { event: "node_leave" },
    });

    if (this.config.onNodeLeave) {
      this.config.onNodeLeave(this.nodeId);
    }
  }

  private async setupPubSub(): Promise<void> {
    const storageType = this.options.storage?.type;

    if (storageType === "redis") {
      try {
        const RedisAdapter = await import("../storage/redis-storage.adapter");
        if (this.storage instanceof RedisAdapter.RedisStorageAdapter) {
          const redisClient = (this.storage as any).getClient();
          this.pubSubClient = redisClient.duplicate();

          await this.pubSubClient.subscribe(this.config.channel || "nest-shield:sync");

          this.pubSubClient.on("message", async (channel: string, message: string) => {
            await this.handleSyncMessage(JSON.parse(message));
          });
        }
      } catch (error) {
        this.logger.warn("Failed to setup Redis pub/sub", error);
      }
    }
  }

  private async closePubSub(): Promise<void> {
    if (this.pubSubClient) {
      await this.pubSubClient.unsubscribe();
      await this.pubSubClient.quit();
    }
  }

  private startSyncInterval(): void {
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, this.config.syncInterval);
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupDeadNodes();
    }, this.config.syncInterval * 3);
  }

  private async performSync(): Promise<void> {
    await this.sendHeartbeat();
    await this.discoverNodes();
    await this.syncMetrics();
  }

  private async sendHeartbeat(): Promise<void> {
    const nodeInfo: NodeInfo = {
      id: this.nodeId,
      lastHeartbeat: Date.now(),
      metadata: await this.collectNodeMetadata(),
    };

    await this.storage.set(`node:${this.nodeId}`, nodeInfo, 60);

    await this.broadcastMessage({
      type: "heartbeat",
      nodeId: this.nodeId,
      timestamp: Date.now(),
      data: nodeInfo,
    });
  }

  private async discoverNodes(): Promise<void> {
    const nodeKeys = (await this.storage.scan?.("node:*", 100)) || [];

    for (const key of nodeKeys) {
      if (key === `node:${this.nodeId}`) continue;

      const nodeInfo = await this.storage.get(key);
      if (nodeInfo) {
        const existingNode = this.nodes.get(nodeInfo.id);

        if (!existingNode) {
          this.nodes.set(nodeInfo.id, nodeInfo);
          this.logger.log(`Discovered new node: ${nodeInfo.id}`);

          if (this.config.onNodeJoin) {
            this.config.onNodeJoin(nodeInfo.id);
          }
        } else {
          this.nodes.set(nodeInfo.id, nodeInfo);
        }
      }
    }
  }

  private async cleanupDeadNodes(): Promise<void> {
    const deadNodeThreshold = this.config.syncInterval * 6;
    const now = Date.now();

    for (const [nodeId, nodeInfo] of this.nodes) {
      if (nodeId === this.nodeId) continue;

      if (now - nodeInfo.lastHeartbeat > deadNodeThreshold) {
        this.nodes.delete(nodeId);
        await this.storage.delete(`node:${nodeId}`);

        this.logger.warn(`Removed dead node: ${nodeId}`);

        if (this.config.onNodeLeave) {
          this.config.onNodeLeave(nodeId);
        }
      }
    }
  }

  private async syncMetrics(): Promise<void> {
    const metrics = await this.collectMetrics();

    await this.broadcastMessage({
      type: "metrics",
      nodeId: this.nodeId,
      timestamp: Date.now(),
      data: metrics,
    });
  }

  private async broadcastMessage(message: SyncMessage): Promise<void> {
    if (this.pubSubClient) {
      await this.pubSubClient.publish(
        this.config.channel || "nest-shield:sync",
        JSON.stringify(message),
      );
    } else {
      await this.storage.set(
        `sync:${message.type}:${this.nodeId}`,
        message,
        this.config.syncInterval / 1000,
      );
    }
  }

  private async handleSyncMessage(message: SyncMessage): Promise<void> {
    if (message.nodeId === this.nodeId) return;

    switch (message.type) {
      case "heartbeat":
        this.nodes.set(message.nodeId, message.data);
        break;

      case "metrics":
        await this.handleMetricsSync(message.data);
        break;

      case "config_update":
        await this.handleConfigSync(message.data);
        break;

      case "custom":
        if (this.config.onSyncData) {
          this.config.onSyncData(message.data);
        }
        break;
    }
  }

  private async handleMetricsSync(metrics: any): Promise<void> {
    // Store aggregated metrics
    await this.storage.set(`metrics:aggregate:${Date.now()}`, metrics, 300);
  }

  private async handleConfigSync(config: any): Promise<void> {
    // Handle configuration synchronization
    this.logger.log("Received config sync", config);
  }

  private async collectNodeMetadata(): Promise<Record<string, any>> {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      pid: process.pid,
      version: process.version,
      hostname: process.env.HOSTNAME || "unknown",
    };
  }

  private async collectMetrics(): Promise<Record<string, any>> {
    // Collect local metrics for synchronization
    return {
      timestamp: Date.now(),
      nodeId: this.nodeId,
      // Add relevant metrics here
    };
  }

  async broadcastCustomData(data: any): Promise<void> {
    await this.broadcastMessage({
      type: "custom",
      nodeId: this.nodeId,
      timestamp: Date.now(),
      data,
    });
  }

  getActiveNodes(): NodeInfo[] {
    return Array.from(this.nodes.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getNodeId(): string {
    return this.nodeId;
  }

  isLeader(): boolean {
    const sortedNodes = Array.from(this.nodes.keys()).sort();
    return sortedNodes[0] === this.nodeId;
  }
}
