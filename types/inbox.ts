export type RelationshipStatus = 'frequent' | 'active' | 'dormant'

export interface Person {
  name:         string
  email:        string
  messageCount: number
  threadCount:  number
  score:        number             // 0–100 human signal score
  confidence:   number             // 0–100 confidence in the score
  relationship: RelationshipStatus
  twoWay:       boolean            // user sent to this person in at least one shared thread
}

export interface Topic {
  name:        string
  threadCount: number
}

export interface NeedsReplyItem {
  threadId:  string   // stable Gmail thread ID — primary key for decision_memory
  subject:   string
  from:      string   // display name
  fromEmail: string   // sender email — stable dedup key
  lastDate:  string
}

export interface InboxAnalysis {
  people:       Person[]
  topics:       Topic[]
  needsReply:   NeedsReplyItem[]
  threadCount:  number
  processedAt:  string
}
