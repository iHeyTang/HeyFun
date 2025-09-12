'use client';

import { getSignedUploadUrl, getSignedUrl } from '@/actions/oss';
import { getAllServiceModelInfos, submitGenerationTask } from '@/actions/paintboard';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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

// Dynamic form schema
const createFormSchema = () => {
  const baseSchema = z.object({
    serviceModel: z.string().min(1, 'Please select model'),
    prompt: z.string().min(1, 'Please enter prompt'),
    aspectRatio: z.string().optional(),
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
      serviceModel: '',
      prompt: '',
      aspectRatio: '',
      duration: 5,
    },
  });

  const watchedServiceModel = form.watch('serviceModel');

  const selectedServiceModel = useMemo(() => {
    return availableModels.find(model => `${model.name}` === watchedServiceModel);
  }, [availableModels, watchedServiceModel]);

  // Get generation type from selected model
  const selectedGenerationType = useMemo(() => {
    if (!selectedServiceModel?.parameterLimits?.generationType) return null;
    return selectedServiceModel.parameterLimits.generationType[0] as GenerationType;
  }, [selectedServiceModel]);

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

  // Reset form when model changes
  useEffect(() => {
    if (watchedServiceModel) {
      // Clear file states when model changes
      setReferenceImageFiles([]);
      setFirstFrameFiles([]);
      setLastFrameFiles([]);
      setUploadedFiles({});
      setSelectedDuration(5);
      form.setValue('duration', 5);
      form.setValue('aspectRatio', '');
    }
  }, [form, watchedServiceModel]);

  const handleSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      // Parse service and model from serviceModel
      const model = data.serviceModel;

      if (!model) {
        toast.error('Invalid service or model information');
        return;
      }

      // Prepare form data with uploaded file URLs and generation type
      const formData = {
        ...data,
        generationType: selectedGenerationType,
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

  const renderCanvasSizeInputs = () => {
    if (!selectedServiceModel?.parameterLimits?.aspectRatio?.length) return null;
    const { aspectRatio } = selectedServiceModel.parameterLimits;
    return (
      <FormField
        control={form.control}
        name="aspectRatio"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Canvas Size</FormLabel>
            <FormControl>
              <ToggleGroup type="single" value={field.value} onValueChange={field.onChange} variant="outline">
                {aspectRatio.map((ratio: string) => {
                  return (
                    <ToggleGroupItem
                      key={ratio}
                      value={ratio}
                      className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-16 w-12 cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <SquareIcon />
                        <span className="text-xs">{ratio}</span>
                      </div>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  const renderDurationInput = () => {
    if (!selectedServiceModel?.parameterLimits?.duration) return null;

    const { duration } = selectedServiceModel.parameterLimits;

    return (
      <FormField
        control={form.control}
        name="duration"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Duration (seconds)</FormLabel>
            <FormControl>
              <ToggleGroup
                type="single"
                value={field.value?.toString()}
                onValueChange={value => {
                  const durationNum = parseInt(value, 10);
                  if (!isNaN(durationNum)) {
                    field.onChange(durationNum);
                    setSelectedDuration(durationNum);
                  }
                }}
                variant="outline"
              >
                {duration.map(d => (
                  <ToggleGroupItem key={d} value={d.toString()} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-16">
                    {d}s
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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
      <FormField
        control={form.control}
        name={fileKey as keyof FormData}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
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
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* AI service and model selection */}
          <FormField
            control={form.control}
            name="serviceModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableModels.map(model => (
                      <SelectItem key={`${model.name}`} value={`${model.name}`}>
                        <div>{model.displayName}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Prompt input */}
          <FormField
            control={form.control}
            name="prompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prompt</FormLabel>
                <FormControl>
                  <Textarea placeholder="Please enter detailed description..." className="min-h-[100px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dynamic parameter inputs based on selected model */}
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
      </Form>
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
