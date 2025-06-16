"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bar, Line } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export function MetricsGrid() {
  const t = useTranslations();
  const [_timeRange, _setTimeRange] = useState("1h");

  // Mock data for demonstration
  const generateMockData = (points: number) => {
    const now = new Date();
    const labels = [];
    const data = [];

    for (let i = points - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000); // 1 minute intervals
      labels.push(time.toLocaleTimeString());
      data.push(Math.floor(Math.random() * 100) + Math.random() * 50);
    }

    return { labels, data };
  };

  const requestsData = generateMockData(60);
  const responseTimeData = generateMockData(60);
  const errorRateData = generateMockData(60);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        beginAtZero: true,
        display: false,
      },
    },
    elements: {
      point: {
        radius: 0,
      },
    },
  };

  const requestsChartData = {
    labels: requestsData.labels,
    datasets: [
      {
        data: requestsData.data,
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const responseTimeChartData = {
    labels: responseTimeData.labels,
    datasets: [
      {
        data: responseTimeData.data,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const errorRateChartData = {
    labels: errorRateData.labels,
    datasets: [
      {
        data: errorRateData.data,
        borderColor: "rgb(239, 68, 68)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("metrics.title")}</CardTitle>
            <CardDescription>Live performance metrics and analytics</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Live
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requests">{t("metrics.requests")}</TabsTrigger>
            <TabsTrigger value="response">{t("metrics.responseTime")}</TabsTrigger>
            <TabsTrigger value="errors">{t("metrics.errorRate")}</TabsTrigger>
            <TabsTrigger value="throughput">{t("metrics.throughput")}</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <div className="h-64">
              <Line data={requestsChartData} options={chartOptions} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">1,247</div>
                <div className="text-xs text-muted-foreground">{t("metrics.lastMinute")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">74,832</div>
                <div className="text-xs text-muted-foreground">{t("metrics.lastHour")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">1.8M</div>
                <div className="text-xs text-muted-foreground">{t("metrics.lastDay")}</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            <div className="h-64">
              <Line data={responseTimeChartData} options={chartOptions} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">245ms</div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">89ms</div>
                <div className="text-xs text-muted-foreground">P50</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">1.2s</div>
                <div className="text-xs text-muted-foreground">P95</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <div className="h-64">
              <Line data={errorRateChartData} options={chartOptions} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-600">0.12%</div>
                <div className="text-xs text-muted-foreground">Error Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">23</div>
                <div className="text-xs text-muted-foreground">4xx Errors</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">3</div>
                <div className="text-xs text-muted-foreground">5xx Errors</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="throughput" className="space-y-4">
            <div className="h-64">
              <Bar data={requestsChartData} options={chartOptions} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">85.4%</div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">1,247</div>
                <div className="text-xs text-muted-foreground">RPS</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">99.9%</div>
                <div className="text-xs text-muted-foreground">Uptime</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
