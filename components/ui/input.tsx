import { cn } from '@/lib/utils';
import { Platform, TextInput, type TextInputProps } from 'react-native';

function Input({
  className,
  placeholderClassName,
  ...props
}: TextInputProps & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'border-[#1f2937] bg-surface text-tprimary flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
          ),
        Platform.select({
          web: cn(
            'placeholder:text-tmuted/70 selection:bg-brand outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-brand focus-visible:ring-brand/50 focus-visible:ring-[2px]'
          ),
          native: 'placeholder:text-tmuted/50',
        }),
        className
      )}
      placeholderTextColor="#6b7280"
      {...props}
    />
  );
}

export { Input };
