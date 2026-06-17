export type PriorityType =
  | 'NEEDS_REPLY'
  | 'FOLLOW_UP'
  | 'IMPORTANT_PERSON'
  | 'OPPORTUNITY'
  | 'DECISION'

export interface RelatedPerson {
  name:  string
  email: string
}

export interface Priority {
  id:             string
  type:           PriorityType
  title:          string
  description:    string
  score:          number          // 0–100, deterministic
  relatedPerson?: RelatedPerson
  relatedThread?: string          // subject line of the relevant thread
  ageInDays?:     number          // days since last message in this thread
}

export interface PrioritiesResult {
  priorities:  Priority[]
  generatedAt: string
}
