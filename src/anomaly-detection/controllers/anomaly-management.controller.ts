import { Put, Post, Param, HttpStatus, HttpException, Get, Controller, Body } from "@nestjs/common";
import type { DetectorManagementService } from "../services";
import type { IAnomalyData } from "../interfaces";

interface IRetrainRequest {
  source: string;
  data: IAnomalyData[];
}

interface IFeedbackRequest {
  source: string;
  data: IAnomalyData[];
  feedback: boolean[];
}

interface IPredictionRequest {
  source: string;
  steps: number;
  includeConfidenceInterval?: boolean;
}

interface IBaselineRequest {
  mean: number;
  stdDev: number;
  count: number;
}

@Controller("api/anomaly-detection/management")
export class AnomalyManagementController {
  constructor(private readonly detectorManagement: DetectorManagementService) {}

  /**
   * Get statistics for all detectors
   */
  @Get("stats")
  async getAllDetectorStats() {
    try {
      const stats = await this.detectorManagement.getDetectorStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get detector stats: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get statistics for a specific detector
   */
  @Get("stats/:detector")
  async getSpecificDetectorStats(@Param("detector") detector: string) {
    try {
      const stats = await this.detectorManagement.getDetectorStats(detector);
      return {
        success: true,
        data: stats,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Analyze data quality for a specific detector
   */
  @Post("quality/:detector")
  async analyzeDataQuality(@Param("detector") detector: string, @Body() data: IAnomalyData[]) {
    try {
      const quality = await this.detectorManagement.analyzeDataQuality(detector, data);
      return {
        success: true,
        detector,
        quality,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get batch anomaly scores
   */
  @Post("score/:detector")
  async batchScoreAnomalies(@Param("detector") detector: string, @Body() data: IAnomalyData[]) {
    try {
      const scores = await this.detectorManagement.batchScoreAnomalies(detector, data);
      return {
        success: true,
        detector,
        scores,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retrain a model with security validation
   */
  @Post("retrain/:detector")
  async retrainModel(@Param("detector") detector: string, @Body() request: IRetrainRequest) {
    try {
      // Security validation: only allow known detector types
      await this.validateDetectorAccess(detector);

      // Validate training data to prevent injection
      await this.validateTrainingData(request.data);

      await this.detectorManagement.retrainModel(detector, request.source, request.data);
      return {
        success: true,
        message: `Model ${detector} retrained successfully`,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validate detector access permissions
   */
  private async validateDetectorAccess(detector: string): Promise<void> {
    // Sanitize detector name to prevent injection
    const sanitizedDetector = detector.replace(/[^\w-]/g, "");

    // List of allowed detector types
    const allowedDetectors = [
      "zscore",
      "statistical",
      "isolation-forest",
      "machine-learning",
      "seasonal",
      "threshold",
      "composite",
    ];

    if (!allowedDetectors.includes(sanitizedDetector)) {
      throw new Error(`Invalid or unauthorized detector type: ${sanitizedDetector}`);
    }
  }

  /**
   * Validate training data to prevent malicious data injection
   */
  private async validateTrainingData(data: any): Promise<void> {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid training data format");
    }

    // Check for prototype pollution attempts
    const dangerousKeys = ["__proto__", "constructor", "prototype"];
    const hasPrototypePollution = (obj: any): boolean => {
      if (!obj || typeof obj !== "object") return false;

      for (const key of dangerousKeys) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          return true;
        }
      }

      return Object.values(obj).some((value) => hasPrototypePollution(value));
    };

    if (hasPrototypePollution(data)) {
      throw new Error("Training data contains potentially malicious content");
    }

    // Limit data size to prevent DoS
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 10 * 1024 * 1024) {
      // 10MB limit
      throw new Error("Training data exceeds maximum allowed size");
    }
  }

  /**
   * Update model with feedback
   */
  @Post("feedback/:detector")
  async updateModelWithFeedback(
    @Param("detector") detector: string,
    @Body() request: IFeedbackRequest,
  ) {
    try {
      await this.detectorManagement.updateModelWithFeedback(
        detector,
        request.source,
        request.data,
        request.feedback,
      );
      return {
        success: true,
        message: `Model ${detector} updated with feedback`,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get seasonal patterns
   */
  @Get("patterns/:detector")
  async getSeasonalPatterns(@Param("detector") detector: string) {
    try {
      const patterns = await this.detectorManagement.getSeasonalPatterns(detector);
      return {
        success: true,
        detector,
        patterns,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Predict next values
   */
  @Post("predict/:detector")
  async predictNextValues(
    @Param("detector") detector: string,
    @Body() request: IPredictionRequest,
  ) {
    try {
      const predictions = await this.detectorManagement.predictNextValues(
        detector,
        request.source,
        request.steps,
        request.includeConfidenceInterval,
      );
      return {
        success: true,
        detector,
        predictions,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get baseline for Z-score detector
   */
  @Get("baseline/:detector")
  async getBaseline(@Param("detector") detector: string) {
    try {
      const baseline = await this.detectorManagement.getBaseline(detector);
      return {
        success: true,
        detector,
        baseline,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set baseline for Z-score detector
   */
  @Put("baseline/:detector")
  async setBaseline(@Param("detector") detector: string, @Body() request: IBaselineRequest) {
    try {
      await this.detectorManagement.setBaseline(
        detector,
        request.mean,
        request.stdDev,
        request.count,
      );
      return {
        success: true,
        message: `Baseline set for ${detector}`,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
