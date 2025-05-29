export class UpdateAgentDto {
  name?: string;
  purpose?: string;
  config?: any; // JSON
}

export class UpdateAgentKnowledgeAccessDto {
  knowledgeEntryIds: string[];
  accessLevel?: 'read' | 'write';
} 