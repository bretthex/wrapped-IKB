const { assert } = require("chai");

let kleinContract
let wrapperContract
let recordOwnerAddress = "0x00d7e4903c6d88deeb29eecd9e7e853a31c46554"
async function impersonate(address){
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address]}
  )
}

async function stopImpersonate(address){
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address]}
  )
}

async function fork(){
  await network.provider.request({
    method: "hardhat_reset",
    params: [{
      forking: {
        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 12063200
      }
    }]
  })
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
  attachKlein().then(deployWrapper).then(done)
})

after(function(done){
  fork().then(done)
})


describe("IKB Wrapper", function() {
  describe("wrapAll", function(){
    it("should mint new NFTs for each owned record if all approved", async function() {
      this.timeout(300000)
      const editions = (await kleinContract.getHolderEditions(recordOwnerAddress)).map(toNumber)
      assert.equal(editions.length, 10)
      await impersonate(recordOwnerAddress)
      const recordOwner = await hre.ethers.provider.getSigner(recordOwnerAddress)
      await (await ethers.getSigners())[0].sendTransaction({
        to: recordOwnerAddress,
        value: ethers.utils.parseEther("10")
      })

      // Wrapper does not have minted editions
      for (let edition of editions){
        try {
          await wrapperContract.ownerOf(edition)
          throw new Error(`Wrapper has edition ${edition} minted`)
        } catch(e){
          assert.isDefined(e)
        }
      }

      assert.equal(toNumber(await wrapperContract.balanceOf(recordOwnerAddress)), 0, 'Wrapper did not properly reset')

      await kleinContract.connect(recordOwner).approve(wrapperContract.address, editions.length)
      await wrapperContract.connect(recordOwner).wrapAll()

      assert.equal(toNumber(await wrapperContract.balanceOf(recordOwnerAddress)), editions.length, 'Wrapper did not mint correct number of tokens')
      assert.equal(toNumber(await kleinContract.balanceOf(recordOwnerAddress)), 0, 'Klein did clear additions for record owner')
      assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), editions.length, 'Klein did not assign all editions to wrapper contract')

      for (let edition of editions){
        assert.equal((await wrapperContract.ownerOf(editions[0])).toLowerCase(), recordOwnerAddress.toLowerCase(), 'Wrapper did not mint correctly')
        assert.equal((await kleinContract.records(edition)).addr.toLowerCase(), wrapperContract.address.toLowerCase(), 'Klein did not assign edition ownership to Wrapper')
      }
    });
  })
});