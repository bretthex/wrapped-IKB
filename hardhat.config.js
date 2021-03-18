/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-waffle");
require('dotenv').config()

module.exports = {
  solidity: {
    compilers: [{version:"0.7.6"},{version:"0.4.24"}]
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 12063200
      }
    }
  }
}