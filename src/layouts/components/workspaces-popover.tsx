import type { Theme, SxProps } from '@mui/material/styles';
import type { ButtonBaseProps } from '@mui/material/ButtonBase';

import { useState, useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Button, { buttonClasses } from '@mui/material/Button';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

export type Workspace = {
  id: string;
  name: string;
  logo?: string;
  plan?: string;
};

export type WorkspacesPopoverProps = Omit<ButtonBaseProps, 'value' | 'onChange' | 'onSelect' | 'selected'> & {
  data?: Workspace[];
  current?: Workspace;
  onWorkspaceChange?: (value: Workspace) => void;
  onCreate?: () => void;
};

export function WorkspacesPopover({
  data = [],
  current,
  onWorkspaceChange,
  onCreate,
  sx,
  ...other
}: WorkspacesPopoverProps) {
  const mediaQuery = 'sm';

  const { open, anchorEl, onClose, onOpen } = usePopover();

  const isControlled = current !== undefined;

  const [internalWorkspace, setInternalWorkspace] = useState(data[0]);

  const workspace = isControlled ? current : internalWorkspace;

  const handleChangeWorkspace = useCallback(
    (newValue: Workspace) => {
      onWorkspaceChange?.(newValue);
      if (!isControlled) {
        setInternalWorkspace(newValue);
      }
      onClose();
    },
    [onWorkspaceChange, isControlled, onClose]
  );

  const buttonBg: SxProps<Theme> = {
    height: 1,
    zIndex: -1,
    opacity: 0,
    content: "''",
    borderRadius: 1,
    position: 'absolute',
    visibility: 'hidden',
    bgcolor: 'action.hover',
    width: 'calc(100% + 8px)',
    transition: (theme) =>
      theme.transitions.create(['opacity', 'visibility'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.shorter,
      }),
    ...(open && {
      opacity: 1,
      visibility: 'visible',
    }),
  };

  const renderButton = () => (
    <ButtonBase
      disableRipple
      onClick={onOpen}
      sx={[
        {
          py: 0.5,
          gap: { xs: 0.5, [mediaQuery]: 1 },
          '&::before': buttonBg,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Avatar
        alt={workspace?.name}
        src={workspace?.logo}
        sx={{ width: 24, height: 24, fontSize: 12 }}
      />

      <Box
        component="span"
        sx={{ typography: 'subtitle2', display: { xs: 'none', [mediaQuery]: 'inline-flex' } }}
      >
        {workspace?.name}
      </Box>

      {!!workspace?.plan && (
        <Label
          color={workspace?.plan === 'Free' ? 'default' : 'info'}
          sx={{
            height: 22,
            cursor: 'inherit',
            display: { xs: 'none', [mediaQuery]: 'inline-flex' },
          }}
        >
          {workspace?.plan}
        </Label>
      )}

      <Iconify width={16} icon="carbon:chevron-sort" sx={{ color: 'text.disabled' }} />
    </ButtonBase>
  );

  const renderMenuList = () => (
    <CustomPopover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      slotProps={{
        arrow: { placement: 'top-left' },
        paper: { sx: { mt: 0.5, ml: -1.55, width: 240 } },
      }}
    >
      <Scrollbar sx={{ maxHeight: 240 }}>
        <MenuList>
          {data.map((option) => (
            <MenuItem
              key={option.id}
              selected={option.id === workspace?.id}
              onClick={() => handleChangeWorkspace(option)}
              sx={{ height: 48 }}
            >
              <Avatar alt={option.name} src={option.logo} sx={{ width: 24, height: 24 }} />

              <Typography
                noWrap
                component="span"
                variant="body2"
                sx={{ flexGrow: 1, fontWeight: 'fontWeightMedium' }}
              >
                {option.name}
              </Typography>

              {!!option.plan && <Label color={option.plan === 'Free' ? 'default' : 'info'}>{option.plan}</Label>}
            </MenuItem>
          ))}
        </MenuList>
      </Scrollbar>

      {!!onCreate && (
        <>
          <Divider sx={{ my: 0.5, borderStyle: 'dashed' }} />

          <Button
            fullWidth
            startIcon={<Iconify width={18} icon="mingcute:add-line" />}
            onClick={() => {
              onClose();
              onCreate();
            }}
            sx={{
              gap: 2,
              justifyContent: 'flex-start',
              fontWeight: 'fontWeightMedium',
              [`& .${buttonClasses.startIcon}`]: {
                m: 0,
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              },
            }}
          >
            Create workspace
          </Button>
        </>
      )}
    </CustomPopover>
  );

  return (
    <>
      {renderButton()}
      {renderMenuList()}
    </>
  );
}
