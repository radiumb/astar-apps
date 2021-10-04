import { ActionTree, Dispatch } from 'vuex';
import { web3FromSource } from '@polkadot/extension-dapp';
import { Option, Struct, BTreeMap } from '@polkadot/types';
import { EraIndex, AccountId, Balance } from '@polkadot/types/interfaces';
import { formatBalance } from '@polkadot/util';
import BN from 'bn.js';
import { StateInterface } from '../index';
import { DappItem, DappStateInterface as State, NewDappItem } from './state';
import { dappsCollection, getDocs, uploadFile, addDapp} from 'src/hooks/firebase';
import { ApiPromise } from '@polkadot/api';

const showError = (dispatch: Dispatch, message: string): void => {
  dispatch('general/showAlertMsg', {
    msg: message,
    alertType: 'error'
  },
  { root: true });
}

// TODO refactor, detect address type, etc.....
const getAddressEnum = (address:string) => (
  {'Evm': address}
);

const getFormattedBalance = (parameters: StakingParameters): string => {
  return formatBalance(parameters.amount, {
    withSi: true,
    decimals: parameters.decimals,
    withUnit: parameters.unit
  });
}

const actions: ActionTree<State, StateInterface> = {
  async getDapps ({ commit, dispatch }) {
    commit('general/setLoading', true, { root: true });

    try {
      const collection = await getDocs(dappsCollection);
      commit('addDapps', collection.docs.map(x => x.data()));
    } catch (e) {
      const error = e as unknown as Error; 
      showError(dispatch, error.message);
    } finally {
      commit('general/setLoading', false, { root: true });
    }
  },

  async registerDapp({ commit, dispatch }, parameters: RegisterParameters): Promise<boolean> {
    commit('general/setLoading', true, { root: true });
    try {
      if (parameters.api) {
        const injector = await web3FromSource('polkadot-js');    
        const unsub = await parameters.api.tx.dappsStaking
          .register(getAddressEnum(parameters.dapp.address))
          .signAndSend(
            parameters.senderAddress,
            {
              signer: injector?.signer
            },
            async result => {
              if (result.status.isFinalized) {
                if (parameters.dapp.iconFileName) {
                  const fileName = `${parameters.dapp.address}_${parameters.dapp.iconFileName}`;
                  parameters.dapp.iconUrl = await uploadFile(fileName, parameters.dapp.iconFile);
                } else {
                  parameters.dapp.iconUrl = '/images/noimage.png';
                }
                
                if (!parameters.dapp.url) {
                  parameters.dapp.url = '';
                }

                const addedDapp = await addDapp(parameters.dapp);
                commit('addDapp', addedDapp);

                commit('general/setLoading', false, { root: true });
                dispatch('general/showAlertMsg', {
                  msg: `You successfully registered dApp ${parameters.dapp.name} to the store.`,
                  alertType: 'success',
                },
                { root: true });
                
                unsub();  
              }
            }
          );
        
        return true;
      } else {
        showError(dispatch, 'Api is undefined.');

        return false;
      }
    } catch (e) {
      const error = e as unknown as Error; 
      console.log(error);
      commit('general/setLoading', false, { root: true });
      showError(dispatch, error.message);
    } 

    return false;
  },
  
  async stake({ commit, dispatch }, parameters: StakingParameters): Promise<boolean> {
    commit('general/setLoading', true, { root: true });
    try {
      if (parameters.api) {
        const injector = await web3FromSource('polkadot-js');    
        const unsub = await parameters.api.tx.dappsStaking
          .bondAndStake(getAddressEnum(parameters.dapp.address), parameters.amount)
          .signAndSend(
            parameters.senderAddress,
            {
              signer: injector?.signer
            },
            result => {
              if (result.status.isFinalized) {
                commit('general/setLoading', false, { root: true });
                dispatch('general/showAlertMsg', {
                  msg: `You staked ${getFormattedBalance(parameters)} on ${parameters.dapp.name}.`,
                  alertType: 'success',
                },
                { root: true });

                parameters.finalizeCallback();
                unsub();
              }
            }
          );
        
        return true;
      } else {
        showError(dispatch, 'Api is undefined');
        return false;
      }
    } catch (e) {
      const error = e as unknown as Error;
      commit('general/setLoading', false, { root: true }); 
      showError(dispatch, error.message);
    }

    return false;
  },

  async unstake({ commit, dispatch }, parameters: StakingParameters): Promise<boolean> {
    commit('general/setLoading', true, { root: true });
    try {
      if (parameters.api) {
        const injector = await web3FromSource('polkadot-js');    
        const unsub = await parameters.api.tx.dappsStaking
          .unbondUnstakeAndWithdraw(getAddressEnum(parameters.dapp.address), parameters.amount)
          .signAndSend(
            parameters.senderAddress,
            {
              signer: injector?.signer
            },
            result => {
              if (result.status.isFinalized) {
                commit('general/setLoading', false, { root: true });
                dispatch('general/showAlertMsg', {
                  msg: `You unstaked ${getFormattedBalance(parameters)} from ${parameters.dapp.name}.`,
                  alertType: 'success',
                },
                { root: true });

                parameters.finalizeCallback();
                unsub();
              }
            }
          );

        return true;
      } else {
        showError(dispatch, 'Api is undefined');
        return false;
      }
    } catch (e) {
      const error = e as unknown as Error; 
      commit('general/setLoading', false, { root: true });
      showError(dispatch, error.message);
    } finally {
      
    }

    return false;
  },

  async claim({ commit, dispatch }, parameters: StakingParameters): Promise<boolean> {
    commit('general/setLoading', true, { root: true });
    try {
      if (parameters.api) {
        const injector = await web3FromSource('polkadot-js');    
        const unsub = await parameters.api.tx.dappsStaking
          .claim(getAddressEnum(parameters.dapp.address))
          .signAndSend(
            parameters.senderAddress,
            {
              signer: injector?.signer
            },
            result => {
              if (result.isFinalized) {
                commit('general/setLoading', false, { root: true });
                dispatch('general/showAlertMsg', {
                  msg: `You claimed from reward ${parameters.dapp.name}.`,
                  alertType: 'success',
                },
                { root: true });

                parameters.finalizeCallback();
                unsub();
              }
            }
          );

        return true;
      } else {
        showError(dispatch, 'Api is undefined');
        return false;
      }
    } catch (e) {
      const error = e as unknown as Error; 
      commit('general/setLoading', false, { root: true });
      showError(dispatch, error.message);
    }

    return false;
  },

  async getStakeInfo({ dispatch }, parameters: StakingParameters): Promise<StakeInfo | undefined> {
    try {
      if (parameters.api) {
        const contractAddress = getAddressEnum(parameters.dapp.address);
        const eraIndexPromise = await parameters.api
          .query
          .dappsStaking
          .contractLastStaked<Option<EraIndex>>(contractAddress);
        const eraIndex = await eraIndexPromise.unwrapOr(null);
        
        if (eraIndex) {
          const stakeInfoPromise = await parameters.api
            .query
            .dappsStaking
            .contractEraStake<Option<EraStakingPoints>>(contractAddress, eraIndex);
          const stakeInfo = await stakeInfoPromise.unwrapOr(null);

          const rewardsClaimed = await parameters.api
            .query
            .dappsStaking
            .rewardsClaimed<Balance>(contractAddress, parameters.senderAddress);
          console.log(rewardsClaimed);

          if (stakeInfo) {
            let yourStake = '';
            for (const [account, balance] of stakeInfo.stakers) {
              if (account.toString() === parameters.senderAddress) {
                yourStake = balance.toHuman();
                break;
              }
            }

            return {
              totalStake: stakeInfo.total.toHuman(),
              yourStake,
              claimedRewards: stakeInfo.claimedRewards.toHuman(),
              userClaimedRewards: rewardsClaimed.toHuman(),
              hasStake: yourStake !== undefined
            } as StakeInfo;
          }
        }
      } else {
        showError(dispatch, 'Api is undefined.');
      }
    } catch (e) {
      // TODO check. There will me many calls to this method. Maybe is better not to show any popup in case of an error.
      console.log(e);
    }
  }
};

export interface RegisterParameters {
  dapp: NewDappItem;
  senderAddress: string;
  api: ApiPromise;
}

export interface StakingParameters {
  dapp: DappItem;
  amount: BN;
  senderAddress: string;
  api: ApiPromise;
  decimals: number,
  unit: string
  finalizeCallback: () => void;
}

export interface StakeInfo {
  yourStake: string | undefined;
  totalStake: string;
  claimedRewards: string;
  userClaimedRewards:string;
  hasStake: boolean;
}

// TODO check why this type is not autogenerated.
// Maybe need to do the following https://polkadot.js.org/docs/api/examples/promise/typegen/
export interface EraStakingPoints extends Struct {
  readonly total: Balance;
  readonly stakers: BTreeMap<AccountId, Balance>;
  readonly formerStakedEra: EraIndex;
  readonly claimedRewards: Balance;
}

export default actions;