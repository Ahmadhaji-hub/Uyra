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

  // ── Directionality + reply latency (Memory V1.5, this-run values) ──
  inboundCount:      number        // messages person→owner this run
  outboundCount:     number        // messages owner→person this run
  replyLatenciesSec: number[]      // inbound→outbound latencies paired this run (seconds)
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
