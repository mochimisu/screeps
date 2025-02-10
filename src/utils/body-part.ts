export function bodyPart(part: BodyPartConstant, count: number): BodyPartConstant[] {
  return Array(count).fill(part) as BodyPartConstant[];
}
