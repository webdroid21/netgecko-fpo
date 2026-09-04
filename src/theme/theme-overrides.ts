import type { ThemeOptions } from './types';

import { createPaletteChannel } from 'minimal-shared/utils';

// ----------------------------------------------------------------------

export const themeOverrides: ThemeOptions = {
  colorSchemes: {
    light: {
      palette: {
        primary: createPaletteChannel({
          lighter: '#E4F7DD',
          light: '#98E87C',
          main: '#4EA82F',
          dark: '#319210',
          darker: '#1A5406',
          contrastText: '#FFFFFF',
        }),
      },
    },
    dark: {
      palette: {
        primary: createPaletteChannel({
          lighter: '#E4F7DD',
          light: '#98E87C',
          main: '#4EA82F',
          dark: '#319210',
          darker: '#1A5406',
          contrastText: '#FFFFFF',
        }),
      },
    },
  },
};
