'use client';

import { getAllServiceModels, submitGenerationTask } from '@/actions/paintboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { zodResolver } from '@hookform/resolvers/zod';
import { GenerationType, ServiceModel } from '@repo/llm/aigc';
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
    canvasSize: z.object({
      width: z.number().min(1, 'Width must be greater than 0'),
      height: z.number().min(1, 'Height must be greater than 0'),
    }),
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
  const [availableModels, setAvailableModels] = useState<ServiceModel[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCanvasSize, setSelectedCanvasSize] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const form = useForm<FormData>({
    resolver: zodResolver(createFormSchema()),
    defaultValues: {
      generationType: 'text-to-image',
      serviceModel: '',
      prompt: '',
      canvasSize: { width: 1024, height: 1024 },
      duration: 5,
    },
  });

  const watchedServiceModel = form.watch('serviceModel');
  const selectedServiceModel = useMemo(() => {
    return availableModels.find(model => `${model.service}:${model.model}` === watchedServiceModel);
  }, [availableModels, watchedServiceModel]);

  const groupedModels = useMemo(() => {
    return availableModels
      .filter(model => model.generationType === selectedGenerationType)
      .reduce(
        (acc, model) => {
          acc[model.service] = [...(acc[model.service] || []), model];
          return acc;
        },
        {} as Record<string, ServiceModel[]>,
      );
  }, [availableModels, selectedGenerationType]);

  // Initialize and get all service models
  useEffect(() => {
    const loadModels = async () => {
      const result = await getAllServiceModels({});
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
    setSelectedCanvasSize('');
    setSelectedDuration(5);
  }, [form, selectedGenerationType]);

  const handleSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      // Parse service and model from serviceModel
      const [service, model] = data.serviceModel.split(':', 2);

      if (!service || !model) {
        toast.error('Invalid service or model information');
        return;
      }

      const result = await submitGenerationTask({
        service,
        model,
        generationType: data.generationType,
        params: data,
      });

      if (result.data) {
        if (result.data.success) {
          toast.success('Task submitted successfully');
          onSubmit?.(result);
        } else {
          toast.error(`Task submission failed: ${result.data?.error || 'Unknown error'}`);
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
    if (!selectedServiceModel?.parameterLimits?.canvasSize) return;

    const parts = ratio.split(':');
    if (parts.length !== 2) return;

    const wStr = parts[0];
    const hStr = parts[1];

    if (!wStr || !hStr) return;

    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);

    if (isNaN(w) || isNaN(h)) return;

    const size = { width: w * 64, height: h * 64 };

    // Ensure within model limits
    if (
      size.width <= selectedServiceModel?.parameterLimits?.canvasSize.maxWidth &&
      size.height <= selectedServiceModel?.parameterLimits?.canvasSize.maxHeight
    ) {
      form.setValue('canvasSize', size);
      setSelectedCanvasSize(ratio);
    }
  };

  const handleDurationChange = (duration: string) => {
    const durationNum = parseInt(duration, 10);
    if (!isNaN(durationNum)) {
      form.setValue('duration', durationNum);
      setSelectedDuration(durationNum);
    }
  };

  const renderCanvasSizeInputs = () => {
    if (!selectedServiceModel?.parameterLimits?.canvasSize) return null;

    const { canvasSize } = selectedServiceModel.parameterLimits;

    return (
      <div className="space-y-4">
        <Label>Canvas Size</Label>
        {/* Preset aspect ratios */}
        {canvasSize.aspectRatio && canvasSize.aspectRatio.length > 0 && (
          <ToggleGroup type="single" value={selectedCanvasSize} onValueChange={handleCanvasSizeChange} variant="outline">
            {canvasSize.aspectRatio.map((ratio: string) => {
              const parts = ratio.split(':');
              if (parts.length !== 2) return null;

              const wStr = parts[0];
              const hStr = parts[1];

              if (!wStr || !hStr) return null;

              const w = parseInt(wStr, 10);
              const h = parseInt(hStr, 10);

              if (isNaN(w) || isNaN(h)) return null;

              const size = { width: w * 64, height: h * 64 };
              // Ensure within model limits
              if (size.width <= canvasSize.maxWidth && size.height <= canvasSize.maxHeight) {
                return (
                  <ToggleGroupItem key={ratio} value={ratio} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-16">
                    {ratio}
                  </ToggleGroupItem>
                );
              }
              return null;
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

  const renderImageUpload = (fieldName: string, label: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="file"
        accept="image/*"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
            // Here should handle file upload, temporarily using filename
            form.setValue(fieldName as keyof FormData, file.name);
          }
        }}
      />
    </div>
  );

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
              {Object.entries(groupedModels).map(([service, models]) => {
                return (
                  <SelectGroup key={service}>
                    <SelectLabel>{service.charAt(0).toUpperCase() + service.slice(1)}</SelectLabel>
                    {models.map(model => (
                      <SelectItem key={`${model.service}:${model.model}`} value={`${model.service}:${model.model}`}>
                        <div className="flex items-center gap-2">
                          <div>{model.displayName}</div>
                          {model.description && <div className="text-muted-foreground text-xs">({model.description})</div>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
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
            {renderImageUpload('referenceImage', 'Reference Image')}
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
            {renderImageUpload('referenceImage', 'Reference Image')}
            {renderCanvasSizeInputs()}
            {renderDurationInput()}
          </>
        )}

        {selectedGenerationType === 'keyframe-to-video' && (
          <>
            {renderImageUpload('firstFrame', 'First Frame')}
            {renderImageUpload('lastFrame', 'Last Frame')}
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
