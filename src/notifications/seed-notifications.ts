import { PrismaClient } from '@prisma/client';
import { NotificationType, NotificationPriority, DeliveryChannel } from './dto/notification.dto';

const prisma = new PrismaClient();

export async function seedNotifications() {
  try {
    // Get the first user for testing
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No users found. Please create a user first.');
      return;
    }

    // Get the first workspace for testing
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      console.log('No workspaces found. Please create a workspace first.');
      return;
    }

    const sampleNotifications = [
      {
        recipientId: user.id,
        workspaceId: workspace.id,
        title: 'Agent Training Complete',
        message: 'Your marketing agent has finished training on the new documents and is ready to use.',
        type: NotificationType.ACTIVITY,
        priority: NotificationPriority.HIGH,
        deliveryChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
        category: 'agent_training',
        actionUrl: '/dashboard/agents',
        actionText: 'View Agent',
        metadata: {
          agentId: 'agent-123',
          trainingDuration: '15 minutes',
          documentsProcessed: 25
        }
      },
      {
        recipientId: user.id,
        workspaceId: workspace.id,
        title: 'New Team Member Joined',
        message: 'Sarah Johnson has joined your workspace and is now part of the marketing team.',
        type: NotificationType.COLLABORATION,
        priority: NotificationPriority.MEDIUM,
        deliveryChannels: [DeliveryChannel.IN_APP],
        category: 'team_update',
        actionUrl: '/dashboard/team',
        actionText: 'View Team',
        metadata: {
          newMemberId: 'user-456',
          memberName: 'Sarah Johnson',
          role: 'Marketing Specialist'
        }
      },
      {
        recipientId: user.id,
        workspaceId: workspace.id,
        title: 'Weekly Analytics Report Ready',
        message: 'Your weekly analytics report is now available with insights from the past 7 days.',
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.LOW,
        deliveryChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
        category: 'report_generation',
        actionUrl: '/dashboard/analytics',
        actionText: 'View Report',
        metadata: {
          reportType: 'weekly',
          period: '2024-01-15 to 2024-01-21',
          totalInteractions: 1247
        }
      },
      {
        recipientId: user.id,
        workspaceId: workspace.id,
        title: 'Security Alert: New Login Detected',
        message: 'A new login was detected from a different device. If this wasn\'t you, please secure your account.',
        type: NotificationType.SECURITY,
        priority: NotificationPriority.CRITICAL,
        deliveryChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL, DeliveryChannel.PUSH],
        category: 'security_alert',
        actionUrl: '/dashboard/settings/security',
        actionText: 'Review Security',
        metadata: {
          loginLocation: 'San Francisco, CA',
          deviceType: 'Desktop',
          ipAddress: '192.168.1.100'
        }
      },
      {
        recipientId: user.id,
        workspaceId: workspace.id,
        title: 'Task Assignment: Review Knowledge Base',
        message: 'You have been assigned to review and update the knowledge base documentation.',
        type: NotificationType.TASK,
        priority: NotificationPriority.HIGH,
        deliveryChannels: [DeliveryChannel.IN_APP],
        category: 'task_assignment',
        actionUrl: '/dashboard/knowledge-base',
        actionText: 'View Task',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        metadata: {
          taskId: 'task-789',
          assignedBy: 'Project Manager',
          dueDate: '2024-01-28'
        }
      },
      {
        recipientId: user.id,
        workspaceId: workspace.id,
        title: 'System Maintenance Scheduled',
        message: 'Scheduled maintenance will occur on Sunday, January 28th from 2:00 AM to 4:00 AM EST.',
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.MEDIUM,
        deliveryChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
        category: 'maintenance',
        metadata: {
          maintenanceType: 'scheduled',
          startTime: '2024-01-28T02:00:00Z',
          endTime: '2024-01-28T04:00:00Z',
          affectedServices: ['API', 'Dashboard']
        }
      },
      {
        recipientId: user.id,
        workspaceId: workspace.id,
        title: 'Canvas Shared With You',
        message: 'John Doe has shared a new canvas "Q1 Marketing Strategy" with you.',
        type: NotificationType.COLLABORATION,
        priority: NotificationPriority.MEDIUM,
        deliveryChannels: [DeliveryChannel.IN_APP],
        category: 'canvas_sharing',
        actionUrl: '/dashboard/canvas',
        actionText: 'View Canvas',
        isRead: true, // This one is already read
        metadata: {
          canvasId: 'canvas-101',
          canvasName: 'Q1 Marketing Strategy',
          sharedBy: 'John Doe'
        }
      }
    ];

    // Create notifications
    for (const notification of sampleNotifications) {
      await prisma.notification.create({
        data: notification
      });
    }

    console.log(`✅ Successfully seeded ${sampleNotifications.length} sample notifications`);
    
    // Display summary
    const totalNotifications = await prisma.notification.count();
    const unreadNotifications = await prisma.notification.count({
      where: { isRead: false }
    });
    
    console.log(`📊 Total notifications: ${totalNotifications}`);
    console.log(`📬 Unread notifications: ${unreadNotifications}`);
    
  } catch (error) {
    console.error('Error seeding notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedNotifications();
} 