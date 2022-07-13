import { ChangeEvent, useEffect } from "react";
import { CHAIN_CONFIG, CHAIN_CONFIG_TYPE } from "../config/chainConfig";
import { WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE } from "../config/web3AuthNetwork";
import { APP_CONFIG, APP_CONFIG_TYPE } from "../config/appConfig";
import styles from "../styles/Home.module.css";
import { Web3AuthContext } from "../services/web3auth";
import { useContext, useState } from "react";
import Switch from "react-switch";
interface IProps {
  setNetwork: (network: WEB3AUTH_NETWORK_TYPE) => void;
  setChain: (chain: CHAIN_CONFIG_TYPE) => void;
  setApp: (App: APP_CONFIG_TYPE) => void;
}

const Setting = ({ setNetwork, setChain, setApp }: IProps) => {
  useEffect(() => {
    setApp(sessionStorage.getItem("app") as APP_CONFIG_TYPE);
    if(sessionStorage.getItem("app") === "SPA"){
      setChecked(false);
    }else{
      setChecked(true);
    }
  });
  const networkChangeHandler = (e: ChangeEvent<HTMLSelectElement>) => {
    console.log("Settings", e.target.value);
    setNetwork(e.target.value as WEB3AUTH_NETWORK_TYPE);
  };

  const chainChangeHandler = (e: ChangeEvent<HTMLSelectElement>) => {
    console.log("Settings", e.target.value);
    setChain(e.target.value as CHAIN_CONFIG_TYPE);
  };

  const appChangeHandler = (appType:  string) => {
    console.log("Settings", appType);
    // setChecked(!checked);
    setApp(appType as APP_CONFIG_TYPE);
    sessionStorage.setItem("app", appType);
  };
  const handleChange = (nextChecked: boolean) => {
    setChecked(nextChecked);
    if(checked)
      appChangeHandler('SPA')
    else
      appChangeHandler('RWA')

  };
  const { provider } = useContext(Web3AuthContext);
  const isLoggedIn = provider !== null;
  const [checked, setChecked] = useState(false);
  return (
    <div className={styles.setting}>
      <div className={styles.hide}>
        <label htmlFor="network" className={styles.label}>
          Web3Auth Network
        </label>
        <select id="network" onChange={networkChangeHandler} className={styles.select} disabled={isLoggedIn}>
          {Object.keys(WEB3AUTH_NETWORK).map((x: string) => {
            return (
              <option key={x} value={x}>
                {WEB3AUTH_NETWORK[x as WEB3AUTH_NETWORK_TYPE].displayName}
              </option>
            );
          })}
        </select>
      </div>
      <div className={styles.hide}>
        <label htmlFor="network" className={styles.label}>
          Blockchain
        </label>
        <select onChange={chainChangeHandler} className={styles.select} disabled={isLoggedIn}>
          {Object.keys(CHAIN_CONFIG).map((x: string) => {
            return (
              <option key={x} value={x}>
                {CHAIN_CONFIG[x as CHAIN_CONFIG_TYPE].displayName}
              </option>
            );
          })}
        </select>
      </div>
      <div className={styles.row}>
        <Switch
          onChange={handleChange}
          checked={checked}
          onColor="#86d3ff"
          onHandleColor="#2693e6"
          handleDiameter={30}
          uncheckedIcon={false}
          checkedIcon={false}
          height={20}
          width={48}
          disabled={isLoggedIn}
        />
      </div>
      <div className={styles.row}>
        <label htmlFor="app" className={styles.label}>
        App Type: { !checked?"SPA": "RWA"}
        </label>
      </div>

      {/* <select onChange={appChangeHandler} className={styles.select} disabled={isLoggedIn} value={window.sessionStorage.getItem("app") as string}>
          {Object.keys(APP_CONFIG).map((x: string) => {
            return (
              <option key={x} value={x}>
                {APP_CONFIG[x as APP_CONFIG_TYPE].displayName}
              </option>
            );
          })}
        </select> */}
    </div>
  );
};

export default Setting;
