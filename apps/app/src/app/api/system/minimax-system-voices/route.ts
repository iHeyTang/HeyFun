import { NextRequest, NextResponse } from 'next/server';
import AIGC from '@repo/llm/aigc';
import { prisma } from '@/lib/server/prisma';
import { restoreAigcTaskResultToStorage } from '@/lib/server/aigc';

const MAX_VOICES = 10;

export const POST = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.SYSTEM_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { provider: string; model: string };

  const models = await AIGC.getAllServiceModels();
  const model = models.find(m => m.providerName === body.provider && m.name === body.model);
  if (!model) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 });
  }
  const voices = await model.getVoiceList();

  const systemVoices = await prisma.systemVoices.findMany({ where: { provider: body.provider, model: body.model } });

  let processedCount = 0;
  const processedVoices: { id: string; success: boolean }[] = [];
  for (const voice of voices) {
    console.log('Processing voice:', voice.id);
    const systemVoice = systemVoices.find(v => v.externalVoiceId === voice.id);
    if (systemVoice) {
      console.log('Voice already exists:', voice.id);
      continue;
    }
    if (processedCount >= MAX_VOICES) {
      console.log('Max voices reached:', MAX_VOICES);
      break;
    }
    try {
      const text = '我们一路奋战，不是为了能改变世界，而是为了不让世界改变我们。';
      const params = { text, voice_id: voice.id };
      const taskId = await AIGC.submitGenerationTask(model.name, params);
      console.log('Task submitted:', taskId, 'for voice:', voice.id);
      let attempts = 0;
      const maxAttempts = 10; // 最多轮询10次，每次等待3秒
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        attempts++;
      }

      const result = await AIGC.getTaskResult({ modelName: model.name, taskId, params });
      if (result.status === 'completed' && result.data?.[0]) {
        const store = await restoreAigcTaskResultToStorage(`system/voices/${body.provider}/${model.name}`, result.data[0]);
        await prisma.systemVoices.create({
          data: {
            provider: body.provider,
            model: model.name,
            name: voice.name,
            description: voice.description,
            audio: store.key,
            externalVoiceId: voice.id,
            status: 'active',
          },
        });
        processedVoices.push({ id: voice.id, success: true });
        console.log('Voice generated:', voice.id);
      } else {
        throw new Error('Failed to generate voice');
      }
    } catch (error) {
      console.error('Failed to generate voice:', voice.id, error);
      processedVoices.push({ id: voice.id, success: false });
      console.log('Voice generation failed:', voice.id);
    } finally {
      processedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    summary: { success: processedVoices.filter(v => v.success).length, total: processedVoices.length },
    processedVoices,
  });
};
