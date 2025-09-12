'use client';

import { getSignedUploadUrl, getSignedUrl } from '@/actions/oss';
import { getAllServiceModelInfos, submitGenerationTask } from '@/actions/paintboard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Upload, FileWithPreview } from '@/components/ui/upload';
import { zodResolver } from '@hookform/resolvers/zod';
import { BaseAigcModelInfo, GenerationType } from '@repo/llm/aigc';
import { SquareIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

// Generation type options
const generationTypes: { value: GenerationType; label: string; description: string }[] = [
  { value: 'text-to-image', label: 'Text to Image', description: 'Generate images from text descriptions' },
  { value: 'image-to-image', label: 'Image to Image', description: 'Generate new images from reference images and text descriptions' },
  { value: 'text-to-video', label: 'Text to Video', description: 'Generate videos from text descriptions' },
  { value: 'image-to-video', label: 'Image to Video', description: 'Generate videos from reference images and text descriptions' },
  { value: 'keyframe-to-video', label: 'Keyframe to Video', description: 'Generate videos from first and last frames and text descriptions' },
];

// Dynamic form schema
const createFormSchema = () => {
  const baseSchema = z.object({
    generationType: z.enum(['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'keyframe-to-video']),
    serviceModel: z.string().min(1, 'Please select AI service and model'),
    prompt: z.string().min(1, 'Please enter prompt'),
    aspectRatio: z.string().min(1, 'Please select aspect ratio'),
    // Video related parameters
    duration: z.number().optional(),
    referenceImage: z.string().optional(),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
  });

  return baseSchema;
};

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

interface UnifiedGenerationFormProps {
  onSubmit?: (data: unknown) => void;
}

export function UnifiedGenerationForm({ onSubmit }: UnifiedGenerationFormProps) {
  const [selectedGenerationType, setSelectedGenerationType] = useState<GenerationType>('text-to-image');
  const [availableModels, setAvailableModels] = useState<BaseAigcModelInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [referenceImageFiles, setReferenceImageFiles] = useState<FileWithPreview[]>([]);
  const [firstFrameFiles, setFirstFrameFiles] = useState<FileWithPreview[]>([]);
  const [lastFrameFiles, setLastFrameFiles] = useState<FileWithPreview[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({}); // 存储上传后的文件URL
  const form = useForm<FormData>({
    resolver: zodResolver(createFormSchema()),
    defaultValues: {
      generationType: 'text-to-image',
      serviceModel: '',
      prompt: '',
      aspectRatio: '',
      duration: 5,
    },
  });

  const watchedServiceModel = form.watch('serviceModel');
  const watchedAspectRatio = form.watch('aspectRatio');

  const filteredAvailableModels = useMemo(() => {
    return availableModels.filter(model => model.parameterLimits?.generationType?.includes(selectedGenerationType));
  }, [availableModels, selectedGenerationType]);

  const selectedServiceModel = useMemo(() => {
    return availableModels.find(model => `${model.name}` === watchedServiceModel);
  }, [availableModels, watchedServiceModel]);

  // Initialize and get all service models
  useEffect(() => {
    const loadModels = async () => {
      const result = await getAllServiceModelInfos({});
      if (result.data) {
        setAvailableModels(result.data);
      }
    };
    loadModels();
  }, []);

  // Reset form when generation type changes
  useEffect(() => {
    const defaultValues: Record<string, unknown> = {
      generationType: selectedGenerationType,
      serviceModel: '',
      prompt: '',
      canvasSize: { width: 1024, height: 1024 },
      duration: 5,
    };

    form.reset(defaultValues);
    setSelectedDuration(5);
    // Clear file states when generation type changes
    setReferenceImageFiles([]);
    setFirstFrameFiles([]);
    setLastFrameFiles([]);
    setUploadedFiles({});
  }, [form, selectedGenerationType]);

  const handleSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      // Parse service and model from serviceModel
      const model = data.serviceModel;

      if (!model) {
        toast.error('Invalid service or model information');
        return;
      }

      // Prepare form data with uploaded file URLs
      const formData = {
        ...data,
        referenceImage: uploadedFiles['referenceImage'] || '',
        firstFrame: uploadedFiles['firstFrame'] || '',
        lastFrame: uploadedFiles['lastFrame'] || '',
      };

      const result = await submitGenerationTask({ model, params: formData });

      if (result.data) {
        if (result.data.success) {
          toast.success('Task submitted successfully');
          onSubmit?.(result);
        } else {
          toast.error('Task submission failed');
        }
      } else {
        toast.error(`Task submission failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to submit task:', error);
      toast.error('Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerationTypeChange = (type: GenerationType) => {
    setSelectedGenerationType(type);
  };

  const handleCanvasSizeChange = (ratio: string) => {
    if (!selectedServiceModel?.parameterLimits?.aspectRatio?.length) return;
    form.setValue('aspectRatio', ratio);
  };

  const handleDurationChange = (duration: string) => {
    const durationNum = parseInt(duration, 10);
    if (!isNaN(durationNum)) {
      form.setValue('duration', durationNum);
      setSelectedDuration(durationNum);
    }
  };

  const renderCanvasSizeInputs = () => {
    if (!selectedServiceModel?.parameterLimits?.aspectRatio?.length) return null;
    const { aspectRatio } = selectedServiceModel.parameterLimits;
    return (
      <div className="space-y-4">
        <Label>Canvas Size</Label>
        {/* Preset aspect ratios */}
        {aspectRatio && aspectRatio.length > 0 && (
          <ToggleGroup type="single" value={watchedAspectRatio} onValueChange={handleCanvasSizeChange} variant="outline">
            {aspectRatio.map((ratio: string) => {
              return (
                <ToggleGroupItem key={ratio} value={ratio} className="cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-12 h-16">
                  <div className="flex flex-col items-center gap-1">
                    <SquareIcon />
                    <span className="text-xs">{ratio}</span>
                  </div>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        )}
      </div>
    );
  };

  const renderDurationInput = () => {
    if (!selectedServiceModel?.parameterLimits?.duration) return null;

    const { duration } = selectedServiceModel.parameterLimits;

    return (
      <div className="space-y-4">
        <Label>Duration (seconds)</Label>
        <ToggleGroup type="single" value={selectedDuration.toString()} onValueChange={handleDurationChange} variant="outline">
          {duration.map(d => (
            <ToggleGroupItem key={d} value={d.toString()} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-16">
              {d}s
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  };

  const renderImageUpload = (label: string, files: FileWithPreview[], setFiles: (files: FileWithPreview[]) => void, fileKey: string) => {
    // 添加调试信息
    console.log(`renderImageUpload - ${label}:`, files);

    const handleUpload = async (filesToUpload: FileWithPreview[]) => {
      try {
        console.log('handleUpload 开始:', filesToUpload);
        const fileWithPreview = filesToUpload[0];
        if (!fileWithPreview) return;

        console.log('准备上传文件:', fileWithPreview.file.name);
        const url = await uploadFile(fileWithPreview.file, 'paintboard');
        console.log('上传完成，获取到URL:', url);

        if (url) {
          setUploadedFiles(prev => ({
            ...prev,
            [fileKey]: url,
          }));
          console.log('设置上传文件URL成功:', fileKey, url);
          toast.success('文件上传成功');
        } else {
          throw new Error('文件上传失败: Unknown error');
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('文件上传失败');
        throw error;
      }
    };

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Upload
          accept="image/*"
          maxSize={10 * 1024 * 1024} // 10MB
          maxFiles={1}
          value={files}
          onChange={setFiles}
          onUpload={handleUpload}
          size="sm"
          showPreview={true}
          className="max-w-16"
        />
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Generation type selection */}
        <div className="space-y-2">
          <Label>Task Type</Label>
          <Select onValueChange={value => handleGenerationTypeChange(value as GenerationType)} value={selectedGenerationType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Generation Type" />
            </SelectTrigger>
            <SelectContent>
              {generationTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  <span className="font-medium">{type.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* AI service and model selection */}
        <div className="space-y-2">
          <Label>Service & Model</Label>
          <Select onValueChange={value => form.setValue('serviceModel', value)} value={form.watch('serviceModel')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Service & Model" />
            </SelectTrigger>
            <SelectContent>
              {filteredAvailableModels.map(model => (
                <SelectItem key={`${model.name}`} value={`${model.name}`}>
                  <div className="flex items-center gap-2">
                    <div>{model.displayName}</div>
                    {model.description && <div className="text-muted-foreground text-xs">({model.description})</div>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompt input */}
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea id="prompt" placeholder="Please enter detailed description..." className="min-h-[100px]" {...form.register('prompt')} />
        </div>

        {/* Dynamic parameter inputs */}
        {selectedGenerationType === 'text-to-image' && <>{renderCanvasSizeInputs()}</>}

        {selectedGenerationType === 'image-to-image' && (
          <>
            {renderImageUpload('Reference Image', referenceImageFiles, setReferenceImageFiles, 'referenceImage')}
            {renderCanvasSizeInputs()}
          </>
        )}

        {selectedGenerationType === 'text-to-video' && (
          <>
            {renderCanvasSizeInputs()}
            {renderDurationInput()}
          </>
        )}

        {selectedGenerationType === 'image-to-video' && (
          <>
            {renderImageUpload('Reference Image', referenceImageFiles, setReferenceImageFiles, 'referenceImage')}
            {renderCanvasSizeInputs()}
            {renderDurationInput()}
          </>
        )}

        {selectedGenerationType === 'keyframe-to-video' && (
          <>
            {renderImageUpload('First Frame', firstFrameFiles, setFirstFrameFiles, 'firstFrame')}
            {renderImageUpload('Last Frame', lastFrameFiles, setLastFrameFiles, 'lastFrame')}
            {renderCanvasSizeInputs()}
            {renderDurationInput()}
          </>
        )}

        {/* Submit button */}
        <Button type="submit" className="w-full" disabled={isSubmitting || !watchedServiceModel}>
          {isSubmitting ? 'Submitting...' : 'Start Generation'}
        </Button>
      </form>
    </div>
  );
}

export const uploadFile = async (file: File, path: string) => {
  // 获取上传URL
  const uploadUrl = await getSignedUploadUrl({ filePath: path });

  // 上传文件
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(uploadUrl.data!, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const url = await getSignedUrl({ filePath: path });
  return url.data;
};
