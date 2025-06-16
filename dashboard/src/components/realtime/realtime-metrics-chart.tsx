"use client";

import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
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
  Title,
  Tooltip,
  Legend,
  Filler,
);

type MetricsData = {
  requestsPerSecond?: number;
  averageResponseTime?: number;
  errorRate?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  activeConnections?: number;
};

type RealtimeMetricsChartProps = {
  data: MetricsData;
  height?: number;
  showLegend?: boolean;
  interactive?: boolean;
  maxDataPoints?: number;
};

export function RealtimeMetricsChart({
  data,
  height = 300,
  showLegend = false,
  interactive = false,
  maxDataPoints = 60,
}: RealtimeMetricsChartProps) {
  const [chartData, setChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: "Requests/sec",
        data: [] as number[],
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
        yAxisID: "y",
      },
      {
        label: "Response Time (ms)",
        data: [] as number[],
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.4,
        yAxisID: "y1",
      },
      {
        label: "Error Rate (%)",
        data: [] as number[],
        borderColor: "rgb(239, 68, 68)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: true,
        tension: 0.4,
        yAxisID: "y2",
      },
    ],
  });

  const chartRef = useRef<ChartJS<"line", number[], string>>(null);

  useEffect(() => {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    setChartData((prev) => {
      const newLabels = [...prev.labels, timeLabel];
      const newDatasets = prev.datasets.map((dataset, index) => {
        let newValue = 0;

        switch (index) {
          case 0: // Requests/sec
            newValue = data.requestsPerSecond || Math.floor(Math.random() * 200) + 1000;
            break;
          case 1: // Response Time
            newValue = data.averageResponseTime || Math.floor(Math.random() * 100) + 200;
            break;
          case 2: // Error Rate
            newValue = data.errorRate || Math.random() * 2;
            break;
        }

        const newData = [...dataset.data, newValue];

        return {
          ...dataset,
          data: newData.slice(-maxDataPoints),
        };
      });

      return {
        labels: newLabels.slice(-maxDataPoints),
        datasets: newDatasets,
      };
    });
  }, [data, maxDataPoints]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 200,
    },
    plugins: {
      legend: {
        display: showLegend,
        position: "top" as const,
      },
      tooltip: {
        enabled: interactive,
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        ticks: {
          maxTicksLimit: 10,
          font: {
            size: 10,
          },
        },
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: showLegend,
          text: "Requests/sec",
        },
        grid: {
          color: "rgba(59, 130, 246, 0.1)",
        },
        beginAtZero: true,
      },
      y1: {
        type: "linear" as const,
        display: showLegend,
        position: "right" as const,
        title: {
          display: showLegend,
          text: "Response Time (ms)",
        },
        grid: {
          drawOnChartArea: false,
          color: "rgba(34, 197, 94, 0.1)",
        },
        beginAtZero: true,
      },
      y2: {
        type: "linear" as const,
        display: false,
        beginAtZero: true,
        max: 10,
      },
    },
    elements: {
      point: {
        radius: interactive ? 3 : 0,
        hoverRadius: 5,
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  };

  return (
    <div style={{ height }}>
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}
