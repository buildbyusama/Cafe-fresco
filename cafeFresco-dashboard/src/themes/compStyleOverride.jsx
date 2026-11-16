import Grow from '@mui/material/Grow';

// project imports
import componentsOverrides from './overrides';

export default function componentStyleOverrides(theme, borderRadius, outlinedFilled) {
  const bgColor = theme.palette.grey[50];
  // Pale amber selection (matches the sidebar)
  const menuSelectedBack = '#FDF1CC';
  const menuSelected = '#2B2112';

  return {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: '10px',
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'background-color .15s, border-color .15s, color .15s, transform .1s',
          '&:active:not(.Mui-disabled)': { transform: 'scale(0.98)' }
        },
        // dark text on amber is readable; white on amber is not
        containedPrimary: { color: '#1A1A1A', '&:hover': { backgroundColor: '#E8A900' } },
        outlinedInherit: { borderColor: '#E3E2DD', backgroundColor: '#FFFFFF', color: '#333333', '&:hover': { borderColor: '#CFCDC6', backgroundColor: '#FBFAF7' } }
      }
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '& + .MuiFormControlLabel-label': {
            marginTop: 2
          }
        }
      }
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        },
        rounded: {
          borderRadius: `${borderRadius}px`
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(17,17,17,0.05)',
          border: 'none'
        }
      }
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          color: theme.palette.text.dark,
          padding: '24px'
        },
        title: {
          fontSize: '1.125rem'
        }
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '24px'
        }
      }
    },
    MuiCardActions: {
      styleOverrides: {
        root: {
          padding: '24px'
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          alignItems: 'center'
        },
        outlined: {
          border: '1px dashed'
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          color: theme.palette.text.primary,
          paddingTop: '10px',
          paddingBottom: '10px',
          '&.Mui-selected': {
            color: menuSelected,
            backgroundColor: menuSelectedBack,
            '&:hover': {
              backgroundColor: menuSelectedBack
            },
            '& .MuiListItemIcon-root': {
              color: menuSelected
            }
          },
          '&:hover': {
            backgroundColor: menuSelectedBack,
            color: menuSelected,
            '& .MuiListItemIcon-root': {
              color: menuSelected
            }
          }
        }
      }
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: theme.palette.text.primary,
          minWidth: '36px'
        }
      }
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: theme.palette.text.dark
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          color: theme.palette.text.dark,
          '&::placeholder': {
            color: theme.palette.text.secondary,
            fontSize: '0.875rem'
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: outlinedFilled ? bgColor : 'transparent',
          borderRadius: '10px',
          backgroundColor: '#FFFFFF',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#E3E2DD'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#CFCDC6'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#F5B400',
            borderWidth: 1.5
          },
          '&:hover $notchedOutline': {
            borderColor: theme.palette.primary.light
          },
          '&.MuiInputBase-multiline': {
            padding: 1
          }
        },
        input: {
          fontWeight: 500,
          background: outlinedFilled ? bgColor : 'transparent',
          padding: '15.5px 14px',
          borderRadius: `${borderRadius}px`,
          '&.MuiInputBase-inputSizeSmall': {
            padding: '10px 14px',
            '&.MuiInputBase-inputAdornedStart': {
              paddingLeft: 0
            }
          }
        },
        inputAdornedStart: {
          paddingLeft: 4
        },
        notchedOutline: {
          borderRadius: '10px'
        }
      }
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          '&.Mui-disabled': {
            color: theme.palette.grey[300]
          }
        },
        mark: {
          backgroundColor: theme.palette.background.paper,
          width: '4px'
        },
        valueLabel: {
          color: theme.palette.primary.light
        }
      }
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          '& .MuiAutocomplete-tag': {
            background: theme.palette.secondary.light,
            borderRadius: 4,
            color: theme.palette.text.dark,
            '.MuiChip-deleteIcon': {
              color: theme.palette.secondary[200]
            }
          }
        },
        popper: {
          borderRadius: `${borderRadius}px`,
          boxShadow: '0px 8px 10px -5px rgb(0 0 0 / 20%), 0px 16px 24px 2px rgb(0 0 0 / 14%), 0px 6px 30px 5px rgb(0 0 0 / 12%)'
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: theme.palette.divider
        }
      }
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          '&:focus': {
            backgroundColor: 'transparent'
          }
        }
      }
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          color: theme.palette.primary.dark,
          background: theme.palette.primary[200]
        }
      }
    },
    MuiTimelineContent: {
      styleOverrides: {
        root: {
          color: theme.palette.text.dark,
          fontSize: '16px'
        }
      }
    },
    MuiTreeItem: {
      styleOverrides: {
        label: {
          marginTop: 14,
          marginBottom: 14
        }
      }
    },
    MuiTimelineDot: {
      styleOverrides: {
        root: {
          boxShadow: 'none'
        }
      }
    },
    MuiInternalDateTimePickerTabs: {
      styleOverrides: {
        tabs: {
          backgroundColor: theme.palette.primary.light,
          '& .MuiTabs-flexContainer': {
            borderColor: theme.palette.primary[200]
          },
          '& .MuiTab-root': {
            color: theme.palette.text.dark
          },
          '& .MuiTabs-indicator': {
            backgroundColor: theme.palette.primary.dark
          },
          '& .Mui-selected': {
            color: theme.palette.primary.dark
          }
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        flexContainer: {
          borderBottom: '1px solid',
          borderColor: theme.palette.grey[200]
        }
      }
    },
    // Dialogs: soft blurred backdrop, rounded card, consistent title / content / actions spacing
    MuiDialog: {
      defaultProps: { TransitionComponent: Grow },
      styleOverrides: {
        container: { backdropFilter: 'blur(3px)' },
        paper: {
          borderRadius: '18px',
          boxShadow: '0 24px 64px rgba(17,17,17,0.18)',
          border: '1px solid #EEEDE9',
          [theme.breakpoints.down('sm')]: { margin: 12, width: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)' }
        }
      }
    },
    MuiBackdrop: {
      styleOverrides: { root: { '&:not(.MuiBackdrop-invisible)': { backgroundColor: 'rgba(24,22,18,0.38)' } } }
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '8px 24px 16px', '.MuiDialogTitle-root + &': { paddingTop: 8 } } }
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 20px', gap: 8, '& > :not(style) ~ :not(style)': { marginLeft: 0 } } }
    },
    MuiFormLabel: {
      styleOverrides: { root: { '&.Mui-focused': { color: '#9A6B00' } } }
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 4, marginTop: 4 } }
    },
    MuiMenu: {
      styleOverrides: { paper: { borderRadius: '12px', border: '1px solid #EEEDE9', boxShadow: '0 12px 32px rgba(17,17,17,0.12)', marginTop: 4 } }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          borderRadius: '8px',
          margin: '2px 6px',
          '&.Mui-selected': { backgroundColor: '#FDF1CC', '&:hover': { backgroundColor: '#FBE7AE' } },
          '&:hover': { backgroundColor: '#FBFAF7' }
        }
      }
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked': { color: '#F5B400', '& + .MuiSwitch-track': { backgroundColor: '#F5B400', opacity: 0.5 } } }
      }
    },
    MuiLinearProgress: {
      styleOverrides: { root: { backgroundColor: '#FDF1CC', borderRadius: 2 }, bar: { backgroundColor: '#F5B400', borderRadius: 2 } }
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: '#F1EFEA' } }
    },
    // Modern tables: white card, quiet uppercase header, airy rows, warm hover
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(17,17,17,0.05)',
          border: 'none'
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': { backgroundColor: '#FAFAF7' }
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color .15s ease',
          'tbody &:hover': { backgroundColor: '#FFFBF0' },
          'tbody &:last-of-type td': { borderBottom: 'none' },
          // actions column stays on one line
          '& td:last-of-type, & th:last-of-type': { whiteSpace: 'nowrap' }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#F0EFEB',
          fontSize: '0.875rem',
          color: '#222222',
          padding: '14px 16px',
          '&.MuiTableCell-head': {
            fontSize: '0.75rem',
            color: '#6B6B6B',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            paddingTop: 14,
            paddingBottom: 14
          }
        }
      }
    },
    MuiDateTimePickerToolbar: {
      styleOverrides: {
        timeDigitsContainer: {
          alignItems: 'center'
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          margin: 0,
          lineHeight: 1.4,
          color: theme.palette.background.paper,
          background: theme.palette.text.primary
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.125rem',
          fontWeight: 700,
          color: '#111111',
          padding: '20px 24px 8px'
        }
      }
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          margin: '3px',
          borderRadius: '10px',
          fontWeight: 600,
          transition: 'background-color .15s, color .15s',
          '&.Mui-selected': {
            backgroundColor: '#F5B400',
            color: '#1A1A1A',
            '&:hover': { backgroundColor: '#E3A100' }
          }
        }
      }
    },
    MuiDataGrid: {
      defaultProps: {
        rowHeight: 54
      },
      styleOverrides: {
        root: {
          borderWidth: 0,
          '& .MuiDataGrid-columnHeader--filledGroup': {
            borderBottomWidth: 0
          },
          '& .MuiDataGrid-columnHeader--emptyGroup': {
            borderBottomWidth: 0
          },
          '& .MuiFormControl-root>.MuiInputBase-root': {
            backgroundColor: `${theme.palette.background.default} !important`,
            borderColor: `${theme.palette.divider} !important`
          }
        },
        withBorderColor: {
          borderColor: theme.palette.divider
        },
        toolbarContainer: {
          '& .MuiButton-root': {
            paddingLeft: '16px !important',
            paddingRight: '16px !important'
          }
        },
        columnHeader: {
          color: theme.palette.grey[600],
          paddingLeft: 24,
          paddingRight: 24
        },
        footerContainer: {
          '&.MuiDataGrid-withBorderColor': {
            borderBottom: 'none'
          }
        },
        columnHeaderCheckbox: {
          paddingLeft: 0,
          paddingRight: 0
        },
        cellCheckbox: {
          paddingLeft: 0,
          paddingRight: 0
        },
        cell: {
          borderWidth: 1,
          paddingLeft: 24,
          paddingRight: 24,
          borderColor: theme.palette.divider,
          '&.MuiDataGrid-cell--withRenderer > div ': {
            ' > .high': {
              background: theme.palette.success.light
            },
            '& > .medium': {
              background: theme.palette.warning.light
            },
            '& > .low': {
              background: theme.palette.error.light
            }
          }
        }
      }
    },
    ...componentsOverrides(theme)
  };
}
