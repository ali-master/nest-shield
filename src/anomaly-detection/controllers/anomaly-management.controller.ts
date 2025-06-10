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
   * Get statistics for all or specific detectors
   */
  @Get("stats/:detector?")
  async getDetectorStats(@Param("detector") detector?: string) {
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
   * Retrain a model
   */
  @Post("retrain/:detector")
  async retrainModel(@Param("detector") detector: string, @Body() request: IRetrainRequest) {
    try {
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
