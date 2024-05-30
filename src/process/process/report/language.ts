/**
# 仕様
- tagの構造はツリー型：place.roomなど
- tagはそれ自体が内容であることもある
  - 例：place.room.getSectorName()
 */

export type Word = {
  readonly value: string | Sentence
  readonly tags: string[]
}
export type Sentence = (string | Word)[]
