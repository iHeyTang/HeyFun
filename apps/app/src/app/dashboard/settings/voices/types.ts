import { getVoiceCloneTasks, getVoices, getVoiceSupportedModels } from '@/actions/voices';

export type Voice = NonNullable<Awaited<ReturnType<typeof getVoices>>['data']>[number];
export type VoiceCloneTask = NonNullable<Awaited<ReturnType<typeof getVoiceCloneTasks>>['data']>[number];
export type VoiceModel = NonNullable<Awaited<ReturnType<typeof getVoiceSupportedModels>>['data']>[number];
