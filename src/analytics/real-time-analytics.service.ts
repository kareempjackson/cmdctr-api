import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface StreamConfig {
  source: 'database' | 'api' | 'websocket' | 'file' | 'kafka' | 'redis';
  frequency: 'realtime' | '1s' | '5s' | '30s' | '1m' | '5m' | '15m' | '1h';
  filters?: Record<string, any>;
  transformations?: any[];
  aggregations?: any[];
}

export interface RealTimeMetric {
  id: string;
  name: string;
  value: number;
  timestamp: Date;
  change: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  metadata?: any;
}

export interface StreamUpdate {
  dashboardId: string;
  blockId: string;
  data: any;
  timestamp: Date;
  type: 'increment' | 'replace' | 'append' | 'update';
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class RealTimeAnalyticsService {
  @WebSocketServer()
  server: Server;

  private streams: Map<string, any> = new Map();
  private metrics: Map<string, RealTimeMetric> = new Map();
  private subscribers: Map<string, Set<string>> = new Map();

  constructor() {}

  /**
   * Start real-time data streaming for a dashboard
   */
  async startStreaming(
    dashboardId: string,
    config: StreamConfig,
    dataSource: any
  ): Promise<string> {
    console.log('[RealTimeAnalytics] Starting stream for dashboard:', dashboardId);

    const streamId = `stream_${dashboardId}_${Date.now()}`;
    
    const stream = {
      id: streamId,
      dashboardId,
      config,
      dataSource,
      active: true,
      lastUpdate: new Date(),
      metrics: new Map<string, RealTimeMetric>(),
      subscribers: new Set<string>()
    };

    this.streams.set(streamId, stream);

    // Start the data stream
    await this.initializeDataStream(stream);

    return streamId;
  }

  /**
   * Stop real-time streaming
   */
  async stopStreaming(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.active = false;
      this.streams.delete(streamId);
      console.log('[RealTimeAnalytics] Stopped stream:', streamId);
    }
  }

  /**
   * Subscribe to real-time updates
   */
  async subscribeToUpdates(
    dashboardId: string,
    blockId: string,
    clientId: string
  ): Promise<void> {
    const key = `${dashboardId}_${blockId}`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)!.add(clientId);
    
    // Fix: Use socket instance to join room
    this.server.sockets.sockets.get(clientId)?.join(key);
    
    console.log('[RealTimeAnalytics] Client subscribed:', clientId, 'to', key);
  }

  /**
   * Unsubscribe from real-time updates
   */
  async unsubscribeFromUpdates(
    dashboardId: string,
    blockId: string,
    clientId: string
  ): Promise<void> {
    const key = `${dashboardId}_${blockId}`;
    
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.delete(clientId);
      
      if (subscribers.size === 0) {
        this.subscribers.delete(key);
      }
    }
    
    // Fix: Use socket instance to leave room
    this.server.sockets.sockets.get(clientId)?.leave(key);
    
    console.log('[RealTimeAnalytics] Client unsubscribed:', clientId, 'from', key);
  }

  /**
   * Get current real-time metrics
   */
  async getCurrentMetrics(dashboardId: string): Promise<RealTimeMetric[]> {
    const metrics: RealTimeMetric[] = [];
    
    this.streams.forEach(stream => {
      if (stream.dashboardId === dashboardId) {
        stream.metrics.forEach((metric: RealTimeMetric) => {
          metrics.push(metric);
        });
      }
    });
    
    return metrics;
  }

  /**
   * Get metric history
   */
  async getMetricHistory(
    metricId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<RealTimeMetric[]> {
    // In a real implementation, this would query a time-series database
    // For now, return mock historical data
    const history: RealTimeMetric[] = [];
    const interval = 60000; // 1 minute intervals
    
    for (let time = timeRange.start.getTime(); time <= timeRange.end.getTime(); time += interval) {
      history.push({
        id: metricId,
        name: 'Mock Metric',
        value: Math.random() * 100,
        timestamp: new Date(time),
        change: Math.random() * 10 - 5,
        trend: Math.random() > 0.5 ? 'up' : 'down',
        status: Math.random() > 0.8 ? 'warning' : 'good'
      });
    }
    
    return history;
  }

  /**
   * Set up alerting for metrics
   */
  async setupAlerting(
    metricId: string,
    conditions: {
      threshold: number;
      operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
      duration: number; // seconds
    }
  ): Promise<string> {
    const alertId = `alert_${metricId}_${Date.now()}`;
    
    // In a real implementation, this would set up monitoring
    console.log('[RealTimeAnalytics] Alert set up:', alertId, conditions);
    
    return alertId;
  }

  /**
   * Initialize data stream
   */
  private async initializeDataStream(stream: any): Promise<void> {
    const { config, dataSource } = stream;
    
    switch (config.source) {
      case 'database':
        await this.initializeDatabaseStream(stream);
        break;
      case 'api':
        await this.initializeApiStream(stream);
        break;
      case 'websocket':
        await this.initializeWebSocketStream(stream);
        break;
      case 'file':
        await this.initializeFileStream(stream);
        break;
      case 'kafka':
        await this.initializeKafkaStream(stream);
        break;
      case 'redis':
        await this.initializeRedisStream(stream);
        break;
      default:
        throw new Error(`Unsupported data source: ${config.source}`);
    }
  }

  /**
   * Initialize database stream
   */
  private async initializeDatabaseStream(stream: any): Promise<void> {
    const interval = this.getIntervalMs(stream.config.frequency);
    
    const pollData = async () => {
      if (!stream.active) return;
      
      try {
        // In a real implementation, this would query the database
        const newData = await this.simulateDatabaseQuery(stream.dataSource);
        
        // Process and transform data
        const processedData = await this.processStreamData(newData, stream.config);
        
        // Update metrics
        await this.updateMetrics(stream, processedData);
        
        // Emit updates
        await this.emitStreamUpdates(stream, processedData);
        
        stream.lastUpdate = new Date();
        
      } catch (error) {
        console.error('[RealTimeAnalytics] Database stream error:', error);
      }
      
      // Schedule next poll
      setTimeout(pollData, interval);
    };
    
    // Start polling
    pollData();
  }

  /**
   * Initialize API stream
   */
  private async initializeApiStream(stream: any): Promise<void> {
    const interval = this.getIntervalMs(stream.config.frequency);
    
    const pollApi = async () => {
      if (!stream.active) return;
      
      try {
        // In a real implementation, this would make API calls
        const newData = await this.simulateApiCall(stream.dataSource);
        
        // Process and transform data
        const processedData = await this.processStreamData(newData, stream.config);
        
        // Update metrics
        await this.updateMetrics(stream, processedData);
        
        // Emit updates
        await this.emitStreamUpdates(stream, processedData);
        
        stream.lastUpdate = new Date();
        
      } catch (error) {
        console.error('[RealTimeAnalytics] API stream error:', error);
      }
      
      // Schedule next poll
      setTimeout(pollApi, interval);
    };
    
    // Start polling
    pollApi();
  }

  /**
   * Initialize WebSocket stream
   */
  private async initializeWebSocketStream(stream: any): Promise<void> {
    // In a real implementation, this would connect to a WebSocket
    console.log('[RealTimeAnalytics] WebSocket stream initialized for:', stream.id);
    
    // Simulate WebSocket data
    const interval = this.getIntervalMs(stream.config.frequency);
    
    const simulateWebSocketData = async () => {
      if (!stream.active) return;
      
      try {
        const newData = await this.simulateWebSocketData(stream.dataSource);
        
        // Process and transform data
        const processedData = await this.processStreamData(newData, stream.config);
        
        // Update metrics
        await this.updateMetrics(stream, processedData);
        
        // Emit updates
        await this.emitStreamUpdates(stream, processedData);
        
        stream.lastUpdate = new Date();
        
      } catch (error) {
        console.error('[RealTimeAnalytics] WebSocket stream error:', error);
      }
      
      // Schedule next data
      setTimeout(simulateWebSocketData, interval);
    };
    
    // Start simulation
    simulateWebSocketData();
  }

  /**
   * Initialize file stream
   */
  private async initializeFileStream(stream: any): Promise<void> {
    // In a real implementation, this would watch for file changes
    console.log('[RealTimeAnalytics] File stream initialized for:', stream.id);
    
    // Simulate file monitoring
    const interval = this.getIntervalMs(stream.config.frequency);
    
    const monitorFile = async () => {
      if (!stream.active) return;
      
      try {
        const newData = await this.simulateFileRead(stream.dataSource);
        
        // Process and transform data
        const processedData = await this.processStreamData(newData, stream.config);
        
        // Update metrics
        await this.updateMetrics(stream, processedData);
        
        // Emit updates
        await this.emitStreamUpdates(stream, processedData);
        
        stream.lastUpdate = new Date();
        
      } catch (error) {
        console.error('[RealTimeAnalytics] File stream error:', error);
      }
      
      // Schedule next check
      setTimeout(monitorFile, interval);
    };
    
    // Start monitoring
    monitorFile();
  }

  /**
   * Initialize Kafka stream
   */
  private async initializeKafkaStream(stream: any): Promise<void> {
    // In a real implementation, this would connect to Kafka
    console.log('[RealTimeAnalytics] Kafka stream initialized for:', stream.id);
    
    // Simulate Kafka consumer
    const interval = this.getIntervalMs(stream.config.frequency);
    
    const consumeKafka = async () => {
      if (!stream.active) return;
      
      try {
        const newData = await this.simulateKafkaConsume(stream.dataSource);
        
        // Process and transform data
        const processedData = await this.processStreamData(newData, stream.config);
        
        // Update metrics
        await this.updateMetrics(stream, processedData);
        
        // Emit updates
        await this.emitStreamUpdates(stream, processedData);
        
        stream.lastUpdate = new Date();
        
      } catch (error) {
        console.error('[RealTimeAnalytics] Kafka stream error:', error);
      }
      
      // Schedule next consumption
      setTimeout(consumeKafka, interval);
    };
    
    // Start consumption
    consumeKafka();
  }

  /**
   * Initialize Redis stream
   */
  private async initializeRedisStream(stream: any): Promise<void> {
    // In a real implementation, this would connect to Redis
    console.log('[RealTimeAnalytics] Redis stream initialized for:', stream.id);
    
    // Simulate Redis stream consumer
    const interval = this.getIntervalMs(stream.config.frequency);
    
    const consumeRedis = async () => {
      if (!stream.active) return;
      
      try {
        const newData = await this.simulateRedisConsume(stream.dataSource);
        
        // Process and transform data
        const processedData = await this.processStreamData(newData, stream.config);
        
        // Update metrics
        await this.updateMetrics(stream, processedData);
        
        // Emit updates
        await this.emitStreamUpdates(stream, processedData);
        
        stream.lastUpdate = new Date();
        
      } catch (error) {
        console.error('[RealTimeAnalytics] Redis stream error:', error);
      }
      
      // Schedule next consumption
      setTimeout(consumeRedis, interval);
    };
    
    // Start consumption
    consumeRedis();
  }

  /**
   * Process stream data
   */
  private async processStreamData(data: any[], config: StreamConfig): Promise<any[]> {
    let processedData = [...data];

    // Apply filters
    if (config.filters) {
      processedData = this.applyFilters(processedData, config.filters);
    }

    // Apply transformations
    if (config.transformations) {
      processedData = await this.applyTransformations(processedData, config.transformations);
    }

    // Apply aggregations
    if (config.aggregations) {
      processedData = await this.applyAggregations(processedData, config.aggregations);
    }

    return processedData;
  }

  /**
   * Update metrics with new data
   */
  private async updateMetrics(stream: any, data: any[]): Promise<void> {
    // Extract metrics from data
    const metrics = this.extractMetrics(data);
    
    // Update stream metrics
    metrics.forEach(metric => {
      const existingMetric = stream.metrics.get(metric.id);
      
      if (existingMetric) {
        // Calculate change and trend
        const change = metric.value - existingMetric.value;
        const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
        const status = this.calculateStatus(metric.value, change);
        
        metric.change = change;
        metric.trend = trend;
        metric.status = status;
      }
      
      stream.metrics.set(metric.id, metric);
    });
  }

  /**
   * Emit stream updates to subscribers
   */
  private async emitStreamUpdates(stream: any, data: any[]): Promise<void> {
    const updates: StreamUpdate[] = [];
    
    // Generate updates for each block
    stream.metrics.forEach((metric: RealTimeMetric) => {
      const key = `${stream.dashboardId}_${metric.id}`;
      const subscribers = this.subscribers.get(key);
      
      if (subscribers && subscribers.size > 0) {
        updates.push({
          dashboardId: stream.dashboardId,
          blockId: metric.id,
          data: {
            value: metric.value,
            change: metric.change,
            trend: metric.trend,
            status: metric.status,
            timestamp: metric.timestamp
          },
          timestamp: new Date(),
          type: 'update'
        });
      }
    });
    
    // Emit updates via WebSocket
    updates.forEach(update => {
      const key = `${update.dashboardId}_${update.blockId}`;
      this.server.to(key).emit('dashboard-update', update);
    });
  }

  // Helper methods
  private getIntervalMs(frequency: string): number {
    switch (frequency) {
      case 'realtime':
        return 1000; // 1 second
      case '1s':
        return 1000;
      case '5s':
        return 5000;
      case '30s':
        return 30000;
      case '1m':
        return 60000;
      case '5m':
        return 300000;
      case '15m':
        return 900000;
      case '1h':
        return 3600000;
      default:
        return 5000;
    }
  }

  private applyFilters(data: any[], filters: Record<string, any>): any[] {
    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (Array.isArray(value)) {
          return value.includes(item[key]);
        }
        return item[key] === value;
      });
    });
  }

  private async applyTransformations(data: any[], transformations: any[]): Promise<any[]> {
    let transformedData = [...data];
    
    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'map':
          transformedData = transformedData.map(transformation.function);
          break;
        case 'filter':
          transformedData = transformedData.filter(transformation.function);
          break;
        case 'sort':
          transformedData = transformedData.sort(transformation.function);
          break;
        case 'limit':
          transformedData = transformedData.slice(0, transformation.limit);
          break;
      }
    }
    
    return transformedData;
  }

  private async applyAggregations(data: any[], aggregations: any[]): Promise<any[]> {
    const aggregatedData: any[] = [];
    
    for (const aggregation of aggregations) {
      const result = {
        type: aggregation.type,
        field: aggregation.field,
        value: 0
      };
      
      switch (aggregation.type) {
        case 'sum':
          result.value = data.reduce((sum, item) => sum + (parseFloat(item[aggregation.field]) || 0), 0);
          break;
        case 'average':
          const values = data.map(item => parseFloat(item[aggregation.field])).filter(v => !isNaN(v));
          result.value = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'count':
          result.value = data.length;
          break;
        case 'min':
          result.value = Math.min(...data.map(item => parseFloat(item[aggregation.field])).filter(v => !isNaN(v)));
          break;
        case 'max':
          result.value = Math.max(...data.map(item => parseFloat(item[aggregation.field])).filter(v => !isNaN(v)));
          break;
      }
      
      aggregatedData.push(result);
    }
    
    return aggregatedData;
  }

  private extractMetrics(data: any[]): RealTimeMetric[] {
    const metrics: RealTimeMetric[] = [];
    
    // Extract numeric values as metrics
    data.forEach((item, index) => {
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === 'number') {
          metrics.push({
            id: `${key}_${index}`,
            name: key,
            value: value,
            timestamp: new Date(),
            change: 0,
            trend: 'stable',
            status: 'good'
          });
        }
      });
    });
    
    return metrics;
  }

  private calculateStatus(value: number, change: number): 'good' | 'warning' | 'critical' {
    // Simple status calculation - in practice, this would be more sophisticated
    if (Math.abs(change) > value * 0.2) {
      return 'critical';
    } else if (Math.abs(change) > value * 0.1) {
      return 'warning';
    } else {
      return 'good';
    }
  }

  // Simulation methods for different data sources
  private async simulateDatabaseQuery(dataSource: any): Promise<any[]> {
    // Simulate database query
    return Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => ({
      id: i,
      value: Math.random() * 100,
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
      timestamp: new Date()
    }));
  }

  private async simulateApiCall(dataSource: any): Promise<any[]> {
    // Simulate API call
    return Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => ({
      id: i,
      metric: Math.random() * 50,
      status: Math.random() > 0.8 ? 'error' : 'success',
      timestamp: new Date()
    }));
  }

  private async simulateWebSocketData(dataSource: any): Promise<any[]> {
    // Simulate WebSocket data
    return [{
      id: Date.now(),
      value: Math.random() * 200,
      event: 'data_update',
      timestamp: new Date()
    }];
  }

  private async simulateFileRead(dataSource: any): Promise<any[]> {
    // Simulate file read
    return Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({
      id: i,
      content: `Data line ${i}`,
      size: Math.random() * 1000,
      timestamp: new Date()
    }));
  }

  private async simulateKafkaConsume(dataSource: any): Promise<any[]> {
    // Simulate Kafka consumption
    return [{
      id: Date.now(),
      topic: 'data-stream',
      message: { value: Math.random() * 100 },
      timestamp: new Date()
    }];
  }

  private async simulateRedisConsume(dataSource: any): Promise<any[]> {
    // Simulate Redis stream consumption
    return [{
      id: Date.now(),
      stream: 'data-stream',
      data: { value: Math.random() * 100 },
      timestamp: new Date()
    }];
  }
} 