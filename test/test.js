const { expect } = require("chai");

let kleinContract
let wrapperContract
let recordOwnerAddress = "0x00d7e4903c6d88deeb29eecd9e7e853a31c46554"
async function impersonate(address){
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address]}
  )
}

async function fork(){
  await network.provider.request({
    method: "hardhat_reset",
    params: [{forking: {jsonRpcUrl:`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`}}]}
  )
}

async function getRecordOwner(edition){
  return (await kleinContract.records(edition)).addr
}

async function attachKlein(){
  const kleinContractAddress = "0x88AE96845e157558ef59e9Ff90E766E22E480390"
  const kleinArtifact = await artifacts.readArtifact("Klein");
  const Klein = new ethers.Contract(kleinContractAddress, kleinArtifact.abi, await getDefaultProvider());
  kleinContract = Klein.attach(kleinContractAddress)
}

async function deployWrapper(){
  const WrappedIKB = await ethers.getContractFactory("WrappedIKB");
  wrapperContract = await WrappedIKB.deploy();
}

async function getDefaultProvider(){
  return (await ethers.getSigners())[0].provider
}

function toNumber(BN){
  return BN.toNumber()
}

before(function(done){
  this.timeout(300000)
  fork().then(attachKlein).then(deployWrapper).then(done)
})


describe("IKB Wrapper", function() {
  describe("wrapAll", function(){
    it("should mint new NFTs for each owned record if all approved", async function() {
      this.timeout(300000)
      const editions = (await kleinContract.getHolderEditions("0x00d7e4903c6d88deeb29eecd9e7e853a31c46554")).map(toNumber)
      await impersonate(recordOwnerAddress)
      const recordOwner = await hre.ethers.provider.getSigner(recordOwnerAddress)
      await (await ethers.getSigners())[0].sendTransaction({
        to: recordOwnerAddress,
        value: ethers.utils.parseEther("10")
      })
      await kleinContract.connect(recordOwner).approve(wrapperContract.address, editions.length)
      await wrapperContract.connect(recordOwner).wrapAll()

    });
  })
});