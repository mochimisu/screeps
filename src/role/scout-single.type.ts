export interface ScoutSingleMemory extends CreepMemory {
  role: "scout-single";
}
export type ScoutSingleCreep = Creep & {
  memory: ScoutSingleMemory;
};
