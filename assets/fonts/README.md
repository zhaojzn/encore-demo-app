# Font Setup Instructions

## Download Required Fonts

You need to download the following font files and place them in this directory:

### Timmana Font Family
Go to: https://fonts.google.com/specimen/Timmana
Download and extract this file:
- Timmana-Regular.ttf (Note: Timmana only has one weight available)

### Poppins Font Family
Go to: https://fonts.google.com/specimen/Poppins
Download and extract these files:
- Poppins-Regular.ttf
- Poppins-Medium.ttf
- Poppins-SemiBold.ttf
- Poppins-Bold.ttf

## Usage in Your App

Once the fonts are loaded, you can use them in your JSX with these Tailwind classes:

### Timmana Font
- `font-timmana` - Timmana Regular (all weights map to this since Timmana only has one weight)
- `font-timmana-medium` - Timmana Regular
- `font-timmana-semibold` - Timmana Regular  
- `font-timmana-bold` - Timmana Regular

### Poppins Font
- `font-poppins` - Poppins Regular
- `font-poppins-medium` - Poppins Medium
- `font-poppins-semibold` - Poppins SemiBold
- `font-poppins-bold` - Poppins Bold

## Example Usage

```tsx
<Text className="font-timmana text-lg">Timmana Text</Text>
<Text className="font-poppins-medium text-sm">Medium Poppins Text</Text>
```

## Alternative: Use expo-google-fonts

If you prefer not to download fonts manually, you can use expo-google-fonts:

```bash
npx expo install @expo-google-fonts/timmana
npx expo install @expo-google-fonts/poppins
```

Then update your _layout.tsx to use these instead.