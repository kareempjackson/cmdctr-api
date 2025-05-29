import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, NotificationPriority, DeliveryChannel } from './dto/notification.dto';

export async function seedNotificationTemplates(prisma: PrismaService) {
  const templates = [
    // System Notifications
    {
      name: 'system-maintenance',
      type: NotificationType.SYSTEM,
      category: 'maintenance',
      titleTemplate: 'System Maintenance Scheduled',
      messageTemplate: 'System maintenance is scheduled for {{maintenanceTime}}. Expected downtime: {{duration}}.',
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification for scheduled system maintenance',
    },
    {
      name: 'system-update',
      type: NotificationType.SYSTEM,
      category: 'update',
      titleTemplate: 'System Update Available',
      messageTemplate: 'A new system update ({{version}}) is available with {{features}}.',
      defaultPriority: NotificationPriority.MEDIUM,
      defaultChannels: [DeliveryChannel.IN_APP],
      description: 'Notification for system updates',
    },

    // Activity Notifications
    {
      name: 'agent-created',
      type: NotificationType.ACTIVITY,
      category: 'agent',
      titleTemplate: 'New Agent Created',
      messageTemplate: 'Agent "{{agentName}}" was created in workspace "{{workspaceName}}" by {{creatorName}}.',
      defaultPriority: NotificationPriority.MEDIUM,
      defaultChannels: [DeliveryChannel.IN_APP],
      description: 'Notification when a new agent is created',
    },
    {
      name: 'agent-training-complete',
      type: NotificationType.ACTIVITY,
      category: 'agent',
      titleTemplate: 'Agent Training Complete',
      messageTemplate: 'Training for agent "{{agentName}}" has completed successfully. Ready for use!',
      defaultPriority: NotificationPriority.MEDIUM,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification when agent training is complete',
    },
    {
      name: 'note-shared',
      type: NotificationType.ACTIVITY,
      category: 'note',
      titleTemplate: 'Note Shared With You',
      messageTemplate: '{{sharerName}} shared the note "{{noteTitle}}" with you in {{workspaceName}}.',
      defaultPriority: NotificationPriority.MEDIUM,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification when a note is shared',
    },

    // Collaboration Notifications
    {
      name: 'workspace-invitation',
      type: NotificationType.COLLABORATION,
      category: 'invitation',
      titleTemplate: 'Workspace Invitation',
      messageTemplate: '{{inviterName}} invited you to join the workspace "{{workspaceName}}".',
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification for workspace invitations',
    },
    {
      name: 'team-member-joined',
      type: NotificationType.COLLABORATION,
      category: 'team',
      titleTemplate: 'New Team Member',
      messageTemplate: '{{memberName}} joined your workspace "{{workspaceName}}".',
      defaultPriority: NotificationPriority.MEDIUM,
      defaultChannels: [DeliveryChannel.IN_APP],
      description: 'Notification when someone joins the workspace',
    },
    {
      name: 'mention',
      type: NotificationType.COLLABORATION,
      category: 'mention',
      titleTemplate: 'You were mentioned',
      messageTemplate: '{{mentionerName}} mentioned you in {{context}}: "{{message}}"',
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification when user is mentioned',
    },

    // Task Notifications
    {
      name: 'task-assigned',
      type: NotificationType.TASK,
      category: 'assignment',
      titleTemplate: 'Task Assigned',
      messageTemplate: '{{assignerName}} assigned you the task "{{taskTitle}}" in {{workspaceName}}.',
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification when a task is assigned',
    },
    {
      name: 'task-deadline',
      type: NotificationType.TASK,
      category: 'deadline',
      titleTemplate: 'Task Deadline Approaching',
      messageTemplate: 'Task "{{taskTitle}}" is due {{dueTime}}. Don\'t forget to complete it!',
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification for approaching task deadlines',
    },
    {
      name: 'jot-reminder',
      type: NotificationType.TASK,
      category: 'reminder',
      titleTemplate: 'Jot Reminder',
      messageTemplate: 'Reminder: {{jotText}}',
      defaultPriority: NotificationPriority.MEDIUM,
      defaultChannels: [DeliveryChannel.IN_APP],
      description: 'Notification for jot reminders',
    },

    // Security Notifications
    {
      name: 'login-new-device',
      type: NotificationType.SECURITY,
      category: 'login',
      titleTemplate: 'New Device Login',
      messageTemplate: 'Your account was accessed from a new device: {{device}} from {{location}}.',
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification for logins from new devices',
    },
    {
      name: 'password-changed',
      type: NotificationType.SECURITY,
      category: 'account',
      titleTemplate: 'Password Changed',
      messageTemplate: 'Your account password was changed successfully.',
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification when password is changed',
    },
    {
      name: 'suspicious-activity',
      type: NotificationType.SECURITY,
      category: 'security',
      titleTemplate: 'Suspicious Activity Detected',
      messageTemplate: 'Suspicious activity detected on your account: {{activityDescription}}. Please review your account security.',
      defaultPriority: NotificationPriority.CRITICAL,
      defaultChannels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      description: 'Notification for suspicious account activity',
    },
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
  }

  console.log(`✅ Seeded ${templates.length} notification templates`);
}

export async function seedDefaultNotificationPreferences(prisma: PrismaService) {
  console.log('✅ Notification preferences seeding skipped for now');
} 