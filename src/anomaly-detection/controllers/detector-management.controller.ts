import {
  Query,
  Put,
  Post,
  Param,
  HttpStatus,
  HttpException,
  Get,
  Controller,
  Body,
} from "@nestjs/common";
import type { DetectorManagementService } from "../services";
import type { IAnomalyData } from "../interfaces";

@Controller("anomaly-detection/detectors")
export class DetectorManagementController {
  constructor(private readonly detectorManagementService: DetectorManagementService) {}

  @Get("stats")
  getDetectorStats(@Query("detectorName") detectorName?: string) {
    try {
      return this.detectorManagementService.getDetectorStats(detectorName);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(":detectorName/data-quality")
  analyzeDataQuality(
    @Param("detectorName") detectorName: string,
    @Body() data: { data: IAnomalyData[] },
  ) {
    try {
      const result = this.detectorManagementService.analyzeDataQuality(detectorName, data.data);
      if (!result) {
        throw new HttpException("Unable to analyze data quality", HttpStatus.BAD_REQUEST);
      }
      return result;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(":detectorName/batch-score")
  async batchScoreAnomalies(
    @Param("detectorName") detectorName: string,
    @Body() data: { data: IAnomalyData[] },
  ) {
    try {
      return await this.detectorManagementService.batchScoreAnomalies(detectorName, data.data);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(":detectorName/retrain")
  async retrainModel(
    @Param("detectorName") detectorName: string,
    @Body() data: { source: string; data: IAnomalyData[] },
  ) {
    try {
      await this.detectorManagementService.retrainModel(detectorName, data.source, data.data);
      return { message: "Model retrained successfully" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(":detectorName/feedback")
  async updateModelWithFeedback(
    @Param("detectorName") detectorName: string,
    @Body() data: { source: string; data: IAnomalyData[]; feedback: boolean[] },
  ) {
    try {
      await this.detectorManagementService.updateModelWithFeedback(
        detectorName,
        data.source,
        data.data,
        data.feedback,
      );
      return { message: "Model updated with feedback" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":detectorName/seasonal-patterns")
  getSeasonalPatterns(@Param("detectorName") detectorName: string) {
    try {
      const patterns = this.detectorManagementService.getSeasonalPatterns(detectorName);
      if (!patterns) {
        throw new HttpException(
          "Detector does not support seasonal patterns",
          HttpStatus.BAD_REQUEST,
        );
      }
      return patterns;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(":detectorName/predict")
  predictNextValues(
    @Param("detectorName") detectorName: string,
    @Body() data: { source: string; steps: number; includeConfidenceInterval?: boolean },
  ) {
    try {
      const predictions = this.detectorManagementService.predictNextValues(
        detectorName,
        data.source,
        data.steps,
        data.includeConfidenceInterval,
      );
      if (!predictions) {
        throw new HttpException("Detector does not support predictions", HttpStatus.BAD_REQUEST);
      }
      return predictions;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":detectorName/baseline")
  getBaseline(@Param("detectorName") detectorName: string) {
    try {
      const baseline = this.detectorManagementService.getBaseline(detectorName);
      if (!baseline) {
        throw new HttpException("Detector does not support baseline", HttpStatus.BAD_REQUEST);
      }
      return baseline;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(":detectorName/baseline")
  setBaseline(
    @Param("detectorName") detectorName: string,
    @Body() data: { mean: number; stdDev: number; count: number },
  ) {
    try {
      this.detectorManagementService.setBaseline(detectorName, data.mean, data.stdDev, data.count);
      return { message: "Baseline updated successfully" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Threshold management endpoints
  @Get(":detectorName/thresholds")
  getThresholds(@Param("detectorName") detectorName: string, @Query("source") source?: string) {
    try {
      const thresholds = this.detectorManagementService.getThresholds(detectorName, source);
      if (!thresholds) {
        throw new HttpException("Detector does not support thresholds", HttpStatus.BAD_REQUEST);
      }
      return thresholds;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(":detectorName/thresholds/:source")
  setThreshold(
    @Param("detectorName") detectorName: string,
    @Param("source") source: string,
    @Body() thresholds: any,
  ) {
    try {
      this.detectorManagementService.setThreshold(detectorName, source, thresholds);
      return { message: "Threshold updated successfully" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":detectorName/adaptive-thresholds")
  getAdaptiveThresholds(@Param("detectorName") detectorName: string) {
    try {
      const thresholds = this.detectorManagementService.getAdaptiveThresholds(detectorName);
      if (!thresholds) {
        throw new HttpException(
          "Detector does not support adaptive thresholds",
          HttpStatus.BAD_REQUEST,
        );
      }
      return thresholds;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(":detectorName/adaptive-thresholds/:source")
  setAdaptiveThresholdsEnabled(
    @Param("detectorName") detectorName: string,
    @Param("source") source: string,
    @Body() data: { enabled: boolean },
  ) {
    try {
      this.detectorManagementService.setAdaptiveThresholdsEnabled(
        detectorName,
        source,
        data.enabled,
      );
      return { message: `Adaptive thresholds ${data.enabled ? "enabled" : "disabled"}` };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Ensemble management endpoints
  @Put(":detectorName/ensemble-strategy")
  setEnsembleStrategy(
    @Param("detectorName") detectorName: string,
    @Body() data: { strategy: string },
  ) {
    try {
      const success = this.detectorManagementService.setEnsembleStrategy(
        detectorName,
        data.strategy,
      );
      if (!success) {
        throw new HttpException(
          "Detector does not support ensemble strategies",
          HttpStatus.BAD_REQUEST,
        );
      }
      return { message: "Ensemble strategy updated successfully" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":detectorName/detector-performance")
  getDetectorPerformance(@Param("detectorName") detectorName: string) {
    try {
      const performance = this.detectorManagementService.getDetectorPerformance(detectorName);
      if (!performance) {
        throw new HttpException(
          "Detector does not support performance metrics",
          HttpStatus.BAD_REQUEST,
        );
      }
      return performance;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(":detectorName/child-detector/:childDetectorName/enabled")
  setDetectorEnabled(
    @Param("detectorName") detectorName: string,
    @Param("childDetectorName") childDetectorName: string,
    @Body() data: { enabled: boolean },
  ) {
    try {
      const success = this.detectorManagementService.setDetectorEnabled(
        detectorName,
        childDetectorName,
        data.enabled,
      );
      if (!success) {
        throw new HttpException(
          "Detector does not support child detector management",
          HttpStatus.BAD_REQUEST,
        );
      }
      return { message: `Child detector ${data.enabled ? "enabled" : "disabled"}` };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(":detectorName/child-detector/:childDetectorName/weight")
  adjustDetectorWeight(
    @Param("detectorName") detectorName: string,
    @Param("childDetectorName") childDetectorName: string,
    @Body() data: { weight: number },
  ) {
    try {
      const success = this.detectorManagementService.adjustDetectorWeight(
        detectorName,
        childDetectorName,
        data.weight,
      );
      if (!success) {
        throw new HttpException(
          "Detector does not support weight adjustment",
          HttpStatus.BAD_REQUEST,
        );
      }
      return { message: "Detector weight adjusted successfully" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":detectorName/ensemble-statistics")
  getEnsembleStatistics(@Param("detectorName") detectorName: string) {
    try {
      const stats = this.detectorManagementService.getEnsembleStatistics(detectorName);
      if (!stats) {
        throw new HttpException(
          "Detector does not support ensemble statistics",
          HttpStatus.BAD_REQUEST,
        );
      }
      return stats;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(":detectorName/child-detector/:childDetectorName/feedback")
  provideDetectorFeedback(
    @Param("detectorName") detectorName: string,
    @Param("childDetectorName") childDetectorName: string,
    @Body() data: { feedback: any[] },
  ) {
    try {
      const success = this.detectorManagementService.provideDetectorFeedback(
        detectorName,
        childDetectorName,
        data.feedback,
      );
      if (!success) {
        throw new HttpException("Detector does not support feedback", HttpStatus.BAD_REQUEST);
      }
      return { message: "Feedback provided successfully" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Machine learning detector endpoints
  @Get(":detectorName/feature-importance/:source")
  getModelFeatureImportance(
    @Param("detectorName") detectorName: string,
    @Param("source") source: string,
  ) {
    try {
      const importance = this.detectorManagementService.getModelFeatureImportance(
        detectorName,
        source,
      );
      if (!importance) {
        throw new HttpException(
          "Detector does not support feature importance",
          HttpStatus.BAD_REQUEST,
        );
      }
      return importance;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Statistical detector endpoints
  @Get(":detectorName/statistical-models")
  getStatisticalModels(@Param("detectorName") detectorName: string) {
    try {
      const models = this.detectorManagementService.getStatisticalModels(detectorName);
      if (!models) {
        throw new HttpException(
          "Detector does not support statistical models",
          HttpStatus.BAD_REQUEST,
        );
      }
      return models;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
