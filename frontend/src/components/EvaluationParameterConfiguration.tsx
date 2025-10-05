import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
  Tooltip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Info as InfoIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Tune as TuneIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import {
  EvaluationParameter,
  EvaluationParameterConfig,
  EvaluationParameterConfigUI,
  TestRunEvaluationConfig,
  EvaluationConfigPreset,
  EvaluationPreset,
  WeightAdjustmentProps,
} from '../types';
import { apiService } from '../services/api';

// Predefined configuration presets
const EVALUATION_PRESETS: EvaluationConfigPreset[] = [
  {
    name: 'Customer Service Focus',
    description: 'Emphasizes empathy and helpfulness for customer support scenarios',
    parameters: [
      { parameter_id: 1, weight: 40, enabled: true }, // Similarity
      { parameter_id: 2, weight: 50, enabled: true }, // Empathy
      { parameter_id: 3, weight: 10, enabled: true }, // No-match
    ],
  },
  {
    name: 'Technical Accuracy',
    description: 'Prioritizes factual correctness and semantic similarity',
    parameters: [
      { parameter_id: 1, weight: 80, enabled: true }, // Similarity
      { parameter_id: 2, weight: 15, enabled: true }, // Empathy
      { parameter_id: 3, weight: 5, enabled: true },  // No-match
    ],
  },
  {
    name: 'Balanced Evaluation',
    description: 'Equal weight across all evaluation dimensions',
    parameters: [
      { parameter_id: 1, weight: 50, enabled: true }, // Similarity
      { parameter_id: 2, weight: 30, enabled: true }, // Empathy
      { parameter_id: 3, weight: 20, enabled: true }, // No-match
    ],
  },
];

interface EvaluationParameterConfigurationProps {
  availableParameters: EvaluationParameter[];
  currentConfig?: TestRunEvaluationConfig;
  onChange: (config: EvaluationParameterConfig[]) => void;
  onSaveConfig?: (name: string, config: EvaluationParameterConfig[]) => Promise<void>;
  disabled?: boolean;
  showPresets?: boolean;
  showSaveOptions?: boolean;
}

const EvaluationParameterConfiguration: React.FC<EvaluationParameterConfigurationProps> = ({
  availableParameters,
  currentConfig,
  onChange,
  onSaveConfig,
  disabled = false,
  showPresets = true,
  showSaveOptions = false,
}) => {
  const [parameters, setParameters] = useState<EvaluationParameterConfigUI[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [configName, setConfigName] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [databasePresets, setDatabasePresets] = useState<EvaluationPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  // Load database presets
  useEffect(() => {
    const loadDatabasePresets = async () => {
      if (showPresets) {
        setLoadingPresets(true);
        try {
          const presets = await apiService.getEvaluationPresets(true, true);
          setDatabasePresets(presets);
        } catch (error) {
          console.error('Failed to load evaluation presets:', error);
        } finally {
          setLoadingPresets(false);
        }
      }
    };

    loadDatabasePresets();
  }, [showPresets]);

  // Initialize parameters from current config or defaults
  useEffect(() => {
    if (currentConfig && currentConfig.parameters.length > 0) {
      // Load from existing config
      const configParams = currentConfig.parameters.map(paramConfig => {
        const parameter = availableParameters.find(p => p.id === paramConfig.parameter_id);
        return {
          ...paramConfig,
          parameter: parameter!,
        };
      }).filter(p => p.parameter); // Filter out parameters that no longer exist

      setParameters(configParams);
    } else if (availableParameters.length > 0) {
      // Create default configuration
      const defaultParams = availableParameters
        .filter(p => p.is_system_default && p.is_active)
        .map(parameter => ({
          parameter_id: parameter.id,
          weight: getDefaultWeight(parameter.parameter_type),
          enabled: true,
          parameter,
        }));

      setParameters(defaultParams);
    }
  }, [availableParameters, currentConfig]);

  // Calculate total weight
  useEffect(() => {
    const total = parameters
      .filter(p => p.enabled)
      .reduce((sum, p) => sum + p.weight, 0);
    setTotalWeight(total);

    // Validate weights
    if (total === 0) {
      setValidationError('At least one parameter must be enabled');
    } else if (total !== 100) {
      setValidationError(`Weights must sum to 100% (currently ${total}%)`);
    } else {
      setValidationError(null);
    }
  }, [parameters]);

  // Notify parent of changes
  useEffect(() => {
    const configs = parameters.map(({ parameter, ...config }) => config);
    onChange(configs);
  }, [parameters, onChange]);

  const getDefaultWeight = (parameterType: string): number => {
    switch (parameterType) {
      case 'similarity': return 60;
      case 'empathy': return 30;
      case 'no_match': return 10;
      default: return 20;
    }
  };

  const getParameterColor = (parameterType: string): string => {
    switch (parameterType) {
      case 'similarity': return '#1976d2'; // Blue
      case 'empathy': return '#2e7d32';    // Green
      case 'no_match': return '#ed6c02';   // Orange
      case 'custom': return '#9c27b0';     // Purple
      default: return '#757575';           // Grey
    }
  };

  const handleWeightChange = (paramId: number, newWeight: number) => {
    setParameters(prev => 
      prev.map(p => 
        p.parameter_id === paramId ? { ...p, weight: newWeight } : p
      )
    );
  };

  const handleEnabledChange = (paramId: number, enabled: boolean) => {
    setParameters(prev => 
      prev.map(p => 
        p.parameter_id === paramId ? { ...p, enabled } : p
      )
    );
  };

  const handleAutoBalance = () => {
    const enabledParams = parameters.filter(p => p.enabled);
    if (enabledParams.length === 0) return;

    const equalWeight = Math.floor(100 / enabledParams.length);
    const remainder = 100 - (equalWeight * enabledParams.length);

    setParameters(prev => 
      prev.map((p, index) => {
        if (!p.enabled) return p;
        
        const enabledIndex = enabledParams.findIndex(ep => ep.parameter_id === p.parameter_id);
        const weight = equalWeight + (enabledIndex < remainder ? 1 : 0);
        
        return { ...p, weight };
      })
    );
  };

  const loadPreset = (preset: EvaluationConfigPreset) => {
    const presetParams = preset.parameters.map(presetConfig => {
      const parameter = availableParameters.find(p => p.id === presetConfig.parameter_id);
      if (!parameter) return null;

      return {
        ...presetConfig,
        parameter,
      };
    }).filter(Boolean) as EvaluationParameterConfigUI[];

    if (presetParams.length > 0) {
      setParameters(presetParams);
    }
  };

  const loadDatabasePreset = (preset: EvaluationPreset) => {
    const presetParams = preset.parameters.map(presetConfig => {
      const parameter = availableParameters.find(p => p.id === presetConfig.parameter_id);
      if (!parameter) return null;

      return {
        ...presetConfig,
        parameter,
      };
    }).filter(Boolean) as EvaluationParameterConfigUI[];

    if (presetParams.length > 0) {
      setParameters(presetParams);
    }
  };

  const handleSaveConfig = async () => {
    if (!onSaveConfig || !configName.trim()) return;

    try {
      const configs = parameters.map(({ parameter, ...config }) => config);
      await onSaveConfig(configName.trim(), configs);
      setSaveDialogOpen(false);
      setConfigName('');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  return (
    <Box>
      {/* Header with preset options */}
      {showPresets && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Evaluation Parameter Configuration
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Typography variant="body2" sx={{ mr: 1, alignSelf: 'center' }}>
              Quick presets:
            </Typography>
            
            {/* Database presets (prioritized) */}
            {databasePresets.map((preset) => (
              <Chip
                key={`db-${preset.id}`}
                label={preset.name}
                onClick={() => loadDatabasePreset(preset)}
                disabled={disabled || loadingPresets}
                size="small"
                variant="outlined"
                color={preset.is_system_default ? "primary" : "secondary"}
                icon={preset.is_system_default ? <LockIcon /> : undefined}
              />
            ))}
            
            {/* Fallback hardcoded presets (if no database presets available) */}
            {databasePresets.length === 0 && !loadingPresets && EVALUATION_PRESETS.map((preset) => (
              <Chip
                key={preset.name}
                label={preset.name}
                onClick={() => loadPreset(preset)}
                disabled={disabled}
                size="small"
                variant="outlined"
                color="default"
              />
            ))}
            
            {loadingPresets && (
              <Chip
                label="Loading presets..."
                disabled
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      )}

      {/* Weight summary */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">
              Total Weight: {totalWeight}%
            </Typography>
            <Box>
              <Tooltip title="Distribute weights evenly">
                <IconButton 
                  onClick={handleAutoBalance} 
                  disabled={disabled}
                  size="small"
                >
                  <TuneIcon />
                </IconButton>
              </Tooltip>
              {showSaveOptions && onSaveConfig && (
                <Tooltip title="Save configuration">
                  <IconButton 
                    onClick={() => setSaveDialogOpen(true)} 
                    disabled={disabled || validationError !== null}
                    size="small"
                  >
                    <SaveIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          <LinearProgress
            variant="determinate"
            value={Math.min(totalWeight, 100)}
            color={totalWeight === 100 ? 'success' : totalWeight > 100 ? 'error' : 'warning'}
            sx={{ height: 8, borderRadius: 4 }}
          />

          {validationError && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {validationError}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Parameter configuration cards */}
      <Grid container spacing={2}>
        {parameters.map((paramConfig) => (
          <Grid item xs={12} md={6} key={paramConfig.parameter_id}>
            <Card 
              sx={{ 
                border: `2px solid ${paramConfig.enabled ? getParameterColor(paramConfig.parameter.parameter_type) : '#e0e0e0'}`,
                opacity: paramConfig.enabled ? 1 : 0.6
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" component="div">
                      {paramConfig.parameter.name}
                    </Typography>
                    {paramConfig.parameter.description && (
                      <Typography variant="body2" color="text.secondary">
                        {paramConfig.parameter.description}
                      </Typography>
                    )}
                  </Box>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={paramConfig.enabled}
                        onChange={(e) => handleEnabledChange(paramConfig.parameter_id, e.target.checked)}
                        disabled={disabled}
                      />
                    }
                    label=""
                    sx={{ ml: 1 }}
                  />
                </Box>

                {paramConfig.enabled && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2">Weight</Typography>
                      <Typography variant="h6" color="primary">
                        {paramConfig.weight}%
                      </Typography>
                    </Box>
                    
                    <Slider
                      value={paramConfig.weight}
                      onChange={(_, value) => handleWeightChange(paramConfig.parameter_id, value as number)}
                      min={0}
                      max={100}
                      step={5}
                      disabled={disabled}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${value}%`}
                      sx={{ 
                        color: getParameterColor(paramConfig.parameter.parameter_type),
                        '& .MuiSlider-thumb': {
                          backgroundColor: getParameterColor(paramConfig.parameter.parameter_type),
                        }
                      }}
                    />
                  </Box>
                )}

                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={paramConfig.parameter.parameter_type}
                    size="small"
                    sx={{ 
                      backgroundColor: getParameterColor(paramConfig.parameter.parameter_type),
                      color: 'white'
                    }}
                  />
                  {paramConfig.parameter.is_system_default && (
                    <Chip
                      label="System Default"
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Save Configuration Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save Evaluation Configuration</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Configuration Name"
            fullWidth
            variant="outlined"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder="e.g., My Custom Config"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveConfig} 
            variant="contained"
            disabled={!configName.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EvaluationParameterConfiguration;