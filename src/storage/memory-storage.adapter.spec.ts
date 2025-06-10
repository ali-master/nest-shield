import { MemoryStorageAdapter } from "./memory-storage.adapter";
import { waitFor } from "../test-utils/mocks";

describe("MemoryStorageAdapter", () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(() => {
    adapter = new MemoryStorageAdapter({
      stdTTL: 0,
      checkperiod: 60,
      useClones: false,
    });
  });

  afterEach(async () => {
    if (adapter.clear) {
      await adapter.clear();
    }
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      const defaultAdapter = new MemoryStorageAdapter();
      expect(defaultAdapter).toBeDefined();
    });

    it("should create with custom options", () => {
      const customAdapter = new MemoryStorageAdapter({
        stdTTL: 3600,
        checkperiod: 120,
        maxKeys: 1000,
        deleteOnExpire: false,
        useClones: true,
      });
      expect(customAdapter).toBeDefined();
    });
  });

  describe("get/set", () => {
    it("should set and get values", async () => {
      await adapter.set("key1", "value1");
      const value = await adapter.get("key1");
      expect(value).toBe("value1");
    });

    it("should return undefined for non-existent key", async () => {
      const value = await adapter.get("non-existent");
      expect(value).toBeUndefined();
    });

    it("should handle different value types", async () => {
      // String
      await adapter.set("string", "test");
      expect(await adapter.get("string")).toBe("test");

      // Number
      await adapter.set("number", 42);
      expect(await adapter.get("number")).toBe(42);

      // Object
      const obj = { foo: "bar", nested: { value: 123 } };
      await adapter.set("object", obj);
      expect(await adapter.get("object")).toEqual(obj);

      // Array
      const arr = [1, 2, 3, { key: "value" }];
      await adapter.set("array", arr);
      expect(await adapter.get("array")).toEqual(arr);

      // Boolean
      await adapter.set("boolean", true);
      expect(await adapter.get("boolean")).toBe(true);

      // Null
      await adapter.set("null", null);
      expect(await adapter.get("null")).toBeNull();
    });

    it("should respect TTL", async () => {
      await adapter.set("expiring", "value", 1); // 1 second TTL

      // Should exist immediately
      expect(await adapter.get("expiring")).toBe("value");

      // Should expire after TTL
      await waitFor(1100);
      expect(await adapter.get("expiring")).toBeUndefined();
    });

    it("should use prefix for keys", async () => {
      await adapter.set("mykey", "myvalue");

      // Check internal keys include prefix
      const keys = adapter.getKeys();
      expect(keys).toContain("shield:mykey");
    });
  });

  describe("delete", () => {
    it("should delete existing key", async () => {
      await adapter.set("to-delete", "value");
      expect(await adapter.exists("to-delete")).toBe(true);

      await adapter.delete("to-delete");
      expect(await adapter.exists("to-delete")).toBe(false);
    });

    it("should not throw when deleting non-existent key", async () => {
      await expect(adapter.delete("non-existent")).resolves.not.toThrow();
    });
  });

  describe("increment/decrement", () => {
    it("should increment numeric values", async () => {
      await adapter.set("counter", 10);

      const result1 = await adapter.increment("counter");
      expect(result1).toBe(11);

      const result2 = await adapter.increment("counter", 5);
      expect(result2).toBe(16);

      expect(await adapter.get("counter")).toBe(16);
    });

    it("should increment non-existent key from 0", async () => {
      const result = await adapter.increment("new-counter");
      expect(result).toBe(1);
    });

    it("should decrement numeric values", async () => {
      await adapter.set("counter", 20);

      const result1 = await adapter.decrement("counter");
      expect(result1).toBe(19);

      const result2 = await adapter.decrement("counter", 5);
      expect(result2).toBe(14);

      expect(await adapter.get("counter")).toBe(14);
    });

    it("should decrement non-existent key from 0", async () => {
      const result = await adapter.decrement("new-counter", 5);
      expect(result).toBe(-5);
    });

    it("should handle string numbers", async () => {
      await adapter.set("string-counter", "10");

      const result = await adapter.increment("string-counter", 5);
      expect(result).toBe(15);
    });
  });

  describe("exists", () => {
    it("should return true for existing key", async () => {
      await adapter.set("exists-key", "value");
      expect(await adapter.exists("exists-key")).toBe(true);
    });

    it("should return false for non-existent key", async () => {
      expect(await adapter.exists("non-existent")).toBe(false);
    });

    it("should return false for expired key", async () => {
      await adapter.set("expiring", "value", 1);
      expect(await adapter.exists("expiring")).toBe(true);

      await waitFor(1100);
      expect(await adapter.exists("expiring")).toBe(false);
    });
  });

  describe("expire", () => {
    it("should set expiration on existing key", async () => {
      await adapter.set("key", "value");
      await adapter.expire("key", 1);

      expect(await adapter.get("key")).toBe("value");

      await waitFor(1100);
      expect(await adapter.get("key")).toBeUndefined();
    });

    it("should update expiration time", async () => {
      await adapter.set("key", "value", 10); // 10 seconds
      await adapter.expire("key", 1); // Change to 1 second

      await waitFor(1100);
      expect(await adapter.get("key")).toBeUndefined();
    });
  });

  describe("ttl", () => {
    it("should return remaining TTL", async () => {
      await adapter.set("ttl-key", "value", 10);

      const ttl = await adapter.ttl("ttl-key");
      expect(ttl).toBeGreaterThan(8);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    it("should return -1 for non-expiring key", async () => {
      await adapter.set("no-ttl", "value");
      const ttl = await adapter.ttl("no-ttl");
      expect(ttl).toBe(-1);
    });

    it("should return -1 for non-existent key", async () => {
      const ttl = await adapter.ttl("non-existent");
      expect(ttl).toBe(-1);
    });
  });

  describe("clear", () => {
    it("should remove all keys", async () => {
      await adapter.set("key1", "value1");
      await adapter.set("key2", "value2");
      await adapter.set("key3", "value3");

      expect(adapter.getKeys().length).toBe(3);

      await adapter.clear();

      expect(adapter.getKeys().length).toBe(0);
      expect(await adapter.get("key1")).toBeUndefined();
      expect(await adapter.get("key2")).toBeUndefined();
      expect(await adapter.get("key3")).toBeUndefined();
    });
  });

  describe("mget/mset", () => {
    it("should get multiple values", async () => {
      await adapter.set("multi1", "value1");
      await adapter.set("multi2", "value2");
      await adapter.set("multi3", "value3");

      const values = await adapter.mget(["multi1", "multi2", "multi3", "non-existent"]);

      expect(values).toEqual(["value1", "value2", "value3", undefined]);
    });

    it("should set multiple values", async () => {
      await adapter.mset([
        ["mset1", "value1"],
        ["mset2", "value2"],
        ["mset3", { complex: "object" }],
      ]);

      expect(await adapter.get("mset1")).toBe("value1");
      expect(await adapter.get("mset2")).toBe("value2");
      expect(await adapter.get("mset3")).toEqual({ complex: "object" });
    });

    it("should set multiple values with TTL", async () => {
      await adapter.mset(
        [
          ["ttl1", "value1"],
          ["ttl2", "value2"],
        ],
        1,
      );

      expect(await adapter.get("ttl1")).toBe("value1");
      expect(await adapter.get("ttl2")).toBe("value2");

      await waitFor(1100);

      expect(await adapter.get("ttl1")).toBeUndefined();
      expect(await adapter.get("ttl2")).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", async () => {
      await adapter.set("stat1", "value1");
      await adapter.set("stat2", "value2");
      await adapter.get("stat1");
      await adapter.get("stat1");
      await adapter.get("non-existent");

      const stats = adapter.getStats();

      expect(stats).toHaveProperty("hits");
      expect(stats).toHaveProperty("misses");
      expect(stats).toHaveProperty("keys");
      expect(stats).toHaveProperty("ksize");
      expect(stats).toHaveProperty("vsize");
    });
  });

  describe("getKeys", () => {
    it("should return all keys with prefix", async () => {
      await adapter.set("key1", "value1");
      await adapter.set("key2", "value2");
      await adapter.set("key3", "value3");

      const keys = adapter.getKeys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain("shield:key1");
      expect(keys).toContain("shield:key2");
      expect(keys).toContain("shield:key3");
    });
  });

  describe("edge cases", () => {
    it("should handle max keys limit", async () => {
      const limitedAdapter = new MemoryStorageAdapter({
        maxKeys: 3,
      });

      await limitedAdapter.set("key1", "value1");
      await limitedAdapter.set("key2", "value2");
      await limitedAdapter.set("key3", "value3");

      // Should throw when max keys exceeded
      await expect(limitedAdapter.set("key4", "value4")).rejects.toThrow(
        "Cache max keys amount exceeded",
      );

      const keys = limitedAdapter.getKeys();
      expect(keys.length).toBe(3);
    });

    it("should handle undefined values", async () => {
      await adapter.set("undefined", undefined);
      const value = await adapter.get("undefined");
      // node-cache stores undefined as null
      expect(value).toBeNull();

      // But key should exist
      expect(await adapter.exists("undefined")).toBe(true);
    });

    it("should handle empty string keys", async () => {
      await adapter.set("", "empty-key-value");
      expect(await adapter.get("")).toBe("empty-key-value");
    });

    it("should handle very large values", async () => {
      const largeObject = {
        data: Array(10000).fill("x").join(""),
        nested: {
          array: Array(100)
            .fill(null)
            .map((_, i) => ({ index: i, value: `item${i}` })),
        },
      };

      await adapter.set("large", largeObject);
      const retrieved = await adapter.get("large");

      expect(retrieved).toEqual(largeObject);
    });

    it("should handle concurrent operations", async () => {
      const operations: Array<Promise<any>> = [];

      // Perform many concurrent operations
      for (let i = 0; i < 100; i++) {
        operations.push(adapter.set(`concurrent${i}`, i));
        operations.push(adapter.increment(`counter${i % 10}`));
        if (i % 5 === 0) {
          operations.push(adapter.get(`concurrent${i - 1}`));
        }
      }

      await Promise.all(operations);

      // Verify some results
      expect(await adapter.get("concurrent50")).toBe(50);
      expect(await adapter.get("counter5")).toBeGreaterThan(0);
    });

    it("should use clones when enabled", async () => {
      const cloneAdapter = new MemoryStorageAdapter({
        useClones: true,
      });

      const original = { value: "original" };
      await cloneAdapter.set("obj", original);

      const retrieved = await cloneAdapter.get("obj");
      retrieved.value = "modified";

      // Original should not be affected when clones are used
      const secondRetrieval = await cloneAdapter.get("obj");
      expect(secondRetrieval.value).toBe("original");
    });

    it("should not use clones when disabled", async () => {
      const noCloneAdapter = new MemoryStorageAdapter({
        useClones: false,
      });

      const original = { value: "original" };
      await noCloneAdapter.set("obj", original);

      const retrieved = await noCloneAdapter.get("obj");
      retrieved.value = "modified";

      // Original should be affected when clones are not used
      const secondRetrieval = await noCloneAdapter.get("obj");
      expect(secondRetrieval.value).toBe("modified");
    });
  });

  describe("inherited methods from BaseStorageAdapter", () => {
    it("should support getMultiple", async () => {
      await adapter.set("multi1", "value1");
      await adapter.set("multi2", "value2");

      const values = await adapter.getMultiple(["multi1", "multi2", "non-existent"]);
      expect(values).toEqual(["value1", "value2", undefined]);
    });

    it("should support setMultiple", async () => {
      await adapter.setMultiple(
        [
          ["set1", "value1"],
          ["set2", "value2"],
        ],
        5,
      );

      expect(await adapter.get("set1")).toBe("value1");
      expect(await adapter.get("set2")).toBe("value2");
    });

    it("should support deleteMultiple", async () => {
      await adapter.set("del1", "value1");
      await adapter.set("del2", "value2");
      await adapter.set("keep", "value3");

      await adapter.deleteMultiple(["del1", "del2"]);

      expect(await adapter.exists("del1")).toBe(false);
      expect(await adapter.exists("del2")).toBe(false);
      expect(await adapter.exists("keep")).toBe(true);
    });
  });
});
