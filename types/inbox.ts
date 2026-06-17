export interface Person {
  name:  string
  email: string
  count: number
}

export interface Topic {
  name:        string
  threadCount: number
}

export interface NeedsReplyItem {
  subject:  string
  from:     string
  lastDate: string
}

export interface InboxAnalysis {
  people:       Person[]
  topics:       Topic[]
  needsReply:   NeedsReplyItem[]
  threadCount:  number
  processedAt:  string
}
