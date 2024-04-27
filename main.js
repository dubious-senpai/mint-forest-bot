const { successLog, failedLog, infoLog } = require('./logger');
const {
  fetchEnergy,
  fetchUserInfo,
  claimEnergy,
  injectEnergy,
  getTokenList,
} = require('./api');
const colors = require('colors');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
  try {
    while (true) {
      process.stdout.write('\x1Bc');
      console.log(colors.cyan('========================================'));
      console.log(colors.cyan('=    MintChain Claimer and Injector    ='));
      console.log(colors.cyan('=           Created by Dante4rt        ='));
      console.log(colors.cyan('========================================'));
      console.log();

      const tokenList = getTokenList();

      for (let i = 0; i < tokenList.length; i++) {
        console.log(
          colors.yellow(`Processing ACCOUNT ${i + 1} of ${tokenList.length}`)
        );
        console.log();

        const token = tokenList[i];
        const userInfo = await fetchUserInfo(token);
        const { id, address, treeId, status, energy } = userInfo.result;

        successLog('Account information retrieved successfully');
        infoLog(`ID      : ${id}`);
        infoLog(`Address : ${address}`);
        infoLog(`Tree ID : ${treeId}`);
        infoLog(`Status  : ${status}`);
        infoLog(`Energy  : ${energy}`);

        const energyList = await fetchEnergy(token);
        let totalEnergy = 0;
        let energyClaimed = 0;
        let retryCount = 0;

        successLog('Energy list retrieved successfully');
        for (const energy of energyList.result) {
          infoLog(`Amount : ${energy.amount}`);
          infoLog(`Type   : ${energy.type}`);
          if (energy.freeze == true) {
            infoLog('Skipping claiming energy because it is frozen');
          } else {
            while (retryCount < 3) {
              try {
                await claimEnergy(token, energy.amount);
                energyClaimed += energy.amount;
                successLog(
                  `* Claimed ${energy.amount} energy for wallet ${address} *`
                );
                break; // Exit the retry loop if claim is successful
              } catch (claimError) {
                failedLog(`Claiming energy failed for wallet ${address}: ${claimError.message}`);
                retryCount++;
                if (retryCount < 3) {
                  failedLog('Retrying...');
                } else {
                  failedLog('Maximum retry attempts reached, skipping to next account...');
                  break;
                }
              }
            }
            if (retryCount === 3) continue; // Continue to the next iteration if max retries reached
          }
        }

        totalEnergy = energy + energyClaimed;
        if (totalEnergy > 0) {
          try {
            const response = await injectEnergy(token, totalEnergy, address);
            if (response.msg == 'ok') {
              successLog(
                `* Injected ${totalEnergy} energy into ${address}'s tree *`
              );
            }
          } catch (injectError) {
            failedLog(`Injecting energy failed for wallet ${address}: ${injectError.message}`);
            failedLog('Skipping to next account...');
            continue; // Continue to the next iteration
          }
        } else {
          infoLog(`Skipping injection for wallet ${address}`);
        }

        console.log(colors.cyan('========================================'));
        console.log();
      }

      // Wait for 24 hours before starting the next iteration
      infoLog('All tasks completed. Waiting for 24 hours before starting again...');
      await delay(24 * 60 * 60 * 1000); // Wait for 24 hours
    }
  } catch (error) {
    failedLog(error.message);
  }
};

module.exports = main;
