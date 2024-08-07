import { web3, AssetOutput, DUST_AMOUNT, ONE_ALPH, stringToHex, addressFromContractId, MINIMAL_CONTRACT_DEPOSIT, ALPH_TOKEN_ID, subContractId, tokenIdFromAddress, Contract } from '@alephium/web3'
import { expectAssertionError, testAddress, getSigners, randomContractId } from '@alephium/web3-test'
import { 
    MockDAOToken, 
    DAO, 
    VotingBox,
    Mint,
    ProposeUpgrade,
    Vote,
    VotingBoxInstance
} from '../artifacts/ts'
import { AddressToByteVec, contract } from '@alephium/web3/dist/src/codec'
import { balanceOf } from './utils'
import assert from 'assert'


describe('unit tests', () => {
  let DAOInstanceId
  let MockDAOTokenInstanceVar

  jest.setTimeout(10000)
  let signers

  // We initialize the fixture variables before each tests
  beforeEach(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    signers = await getSigners(5, ONE_ALPH * 1000n, 0)

    // Deploy the Governance Token
    const { contractInstance: MockDAOTokenInstance } = await MockDAOToken.deploy(signers[0], { 
      initialFields: { 
        symbol: stringToHex('MockDAOToken'),
        name: stringToHex('MockDAOToken'),  
        decimals: 18n,
        totalSupply: 10n ** 18n
      },
      issueTokenAmount: 10n ** 18n
    })

    // Send it to 5 address
    for (let i = 0; i < 5; i++) {
        await Mint.execute(signers[i], {
            initialFields: {token: MockDAOTokenInstance.address, amount: 10n},
            attoAlphAmount: DUST_AMOUNT * 2n
          })
    }
    
    // Deploy the Voting Box contract that will be used as a template
    const {contractInstance: VotingBoxInstance} = await VotingBox.deploy(signers[0], {
        initialFields: {
          voteTokenId: MockDAOTokenInstance.address,
          quorum: 0n,
          votingStart: 0n,
          votingEnd: 0n,
          votesYes: 0n,
          votesNo: 0n
        }
    })

    // Deploy the DAO
    let {contractInstance: DAOInstance} = await DAO.deploy(signers[0], {
        initialFields: {
            voteTokenId: MockDAOTokenInstance.contractId,
            votingBoxId: VotingBoxInstance.contractId,
            quorum: 20n,
            proposalCurrentIndex: 0n
        }
    })

    DAOInstanceId = DAOInstance.contractId
    MockDAOTokenInstanceVar = MockDAOTokenInstance
  })

  test('Propose a new upgrade and try to vote', async () => {
    await ProposeUpgrade.execute(signers[0], {
        initialFields: {
            dao: DAOInstanceId,
            target: randomContractId()},
        attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
    })

    let votingBoxId = subContractId(DAOInstanceId, '1', 0)
    const VotingBoxInstanceVar = new VotingBoxInstance(addressFromContractId(votingBoxId))

    await Vote.execute(signers[0], {
        initialFields: {
            votingBox: votingBoxId,
            vote: true,
            amount: 10n,
            daoToken: MockDAOTokenInstanceVar.contractId
        },
        attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
        tokens: [{id: MockDAOTokenInstanceVar.contractId, amount: 10n}]
     })

     const has0Voted = (await VotingBoxInstanceVar.view.hasVoted({ args: { voter: signers[0].address } })).returns
     expect(has0Voted).toBeTruthy()

     const has1Voted = (await VotingBoxInstanceVar.view.hasVoted({ args: { voter: signers[1].address } })).returns
     expect(has1Voted).toBeFalsy()    

     const proposalAccepted = (await VotingBoxInstanceVar.view.isProposalAccepted()).returns
     expect(proposalAccepted).toEqual(false)
  })


  test('Propose a new upgrade, accept and upgrade', async () => {
    await ProposeUpgrade.execute(signers[0], {
        initialFields: {
            dao: DAOInstanceId,
            target: randomContractId()},
        attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
    })

    let votingBoxId = subContractId(DAOInstanceId, '1', 0)
    const VotingBoxInstanceVar = new VotingBoxInstance(addressFromContractId(votingBoxId))

    await Vote.execute(signers[0], {
        initialFields: {
            votingBox: votingBoxId,
            vote: true,
            amount: 10n,
            daoToken: MockDAOTokenInstanceVar.contractId
        },
        attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
        tokens: [{id: MockDAOTokenInstanceVar.contractId, amount: 10n}]
     })


     await Vote.execute(signers[1], {
        initialFields: {
            votingBox: votingBoxId,
            vote: true,
            amount: 10n,
            daoToken: MockDAOTokenInstanceVar.contractId
        },
        attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
        tokens: [{id: MockDAOTokenInstanceVar.contractId, amount: 10n}]
     })

     const has0Voted = (await VotingBoxInstanceVar.view.hasVoted({ args: { voter: signers[0].address } })).returns
     expect(has0Voted).toBeTruthy()

     const has1Voted = (await VotingBoxInstanceVar.view.hasVoted({ args: { voter: signers[1].address } })).returns
     expect(has1Voted).toBeTruthy()    

     const proposalAccepted = (await VotingBoxInstanceVar.view.isProposalAccepted()).returns
     expect(proposalAccepted).toEqual(true)
  })

})