import PropTypes from 'prop-types';
import { createContext } from 'react';

// project imports
import defaultConfig from 'config';
import useLocalStorage from 'hooks/useLocalStorage';

// initial state
const initialState = {
  ...defaultConfig,
  onChangeFontFamily: () => { },
  onChangeBorderRadius: () => { },
  onReset: () => { }
};

// ==============================|| CONFIG CONTEXT & PROVIDER ||============================== //

const ConfigContext = createContext(initialState);

function ConfigProvider({ children }) {
  // v2 key: settings saved by the old template (Roboto) must not override the new look
  const [config, setConfig] = useLocalStorage('cafefresco-config-v2', {
    fontFamily: initialState.fontFamily,
    borderRadius: initialState.borderRadius
  });

  const onChangeFontFamily = (fontFamily) => {
    setConfig({
      ...config,
      fontFamily
    });
  };

  const onChangeBorderRadius = (event, newValue) => {
    setConfig({
      ...config,
      borderRadius: newValue
    });
  };

  const onReset = () => {
    setConfig({ ...defaultConfig });
  };

  return (
    <ConfigContext.Provider
      value={{
        ...config,
        onChangeFontFamily,
        onChangeBorderRadius,
        onReset
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export { ConfigProvider, ConfigContext };

ConfigProvider.propTypes = { children: PropTypes.node };
