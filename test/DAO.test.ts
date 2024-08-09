import { web3, AssetOutput, DUST_AMOUNT, ONE_ALPH, stringToHex, addressFromContractId, MINIMAL_CONTRACT_DEPOSIT, ALPH_TOKEN_ID, subContractId, tokenIdFromAddress, Contract, node, NodeProvider } from '@alephium/web3'
import { expectAssertionError, testAddress, getSigners, randomContractId } from '@alephium/web3-test'
import { 
    MockDAOToken, 
    DAO, 
    VotingBox,
    Mint,
    ProposeUpgrade,
    Vote,
    VotingBoxInstance,
    CancelVote,
    DAOInstance
} from '../artifacts/ts'
import { AddressToByteVec, contract } from '@alephium/web3/dist/src/codec'
import { balanceOf } from './utils'

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
     expect(proposalAccepted).toBeFalsy()

     const fields = (await VotingBoxInstanceVar.fetchState()).fields
     const proposalAccepted2 = (await VotingBox.tests.isProposalAccepted({
      initialFields: {
        voteTokenId: fields.voteTokenId,
        quorum: fields.quorum,
        votingStart: fields.votingStart,
        votingEnd: fields.votingEnd,
        votesYes: fields.votesYes,
        votesNo: fields.votesNo
      },
      address: VotingBoxInstanceVar.address, 
      blockTimeStamp: Number(fields.votingStart + 86500n),
    })).returns

    //Debug
    //console.log('quorum: ', fields.quorum)
    //console.log('votingStart: ', fields.votingStart)
    //console.log('votingEnd: ', fields.votingEnd)
    //console.log('votesYes: ', fields.votesYes)
    //console.log('votesNo: ', fields.votesNo)

    expect(proposalAccepted2).toBeFalsy()

    const proposalAccepted3 = (await VotingBox.tests.isProposalAccepted({
      initialFields: {
        voteTokenId: fields.voteTokenId,
        quorum: fields.quorum,
        votingStart: fields.votingStart,
        votingEnd: fields.votingEnd,
        votesYes: fields.votesYes,
        votesNo: fields.votesNo
      },
      address: VotingBoxInstanceVar.address, 
      blockTimeStamp: Number(fields.votingEnd + 1n),
    })).returns

    //Debug
    //console.log('quorum: ', fields.quorum)
    //console.log('votingStart: ', fields.votingStart)
    //console.log('votingEnd: ', fields.votingEnd)
    //console.log('votesYes: ', fields.votesYes)
    //console.log('votesNo: ', fields.votesNo)

    expect(proposalAccepted3).toBeTruthy()
  })

  test('Propose a new upgrade, quorum not reached, and cancel votes', async () => {
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
          vote: false,
          amount: 10n,
          daoToken: MockDAOTokenInstanceVar.contractId
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
      tokens: [{id: MockDAOTokenInstanceVar.contractId, amount: 10n}]
    })

    await Vote.execute(signers[2], {
      initialFields: {
          votingBox: votingBoxId,
          vote: false,
          amount: 5n,
          daoToken: MockDAOTokenInstanceVar.contractId
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
      tokens: [{id: MockDAOTokenInstanceVar.contractId, amount: 5n}]
    })

    await Vote.execute(signers[3], {
      initialFields: {
          votingBox: votingBoxId,
          vote: false,
          amount: 7n,
          daoToken: MockDAOTokenInstanceVar.contractId
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
      tokens: [{id: MockDAOTokenInstanceVar.contractId, amount: 7n}]
    })

    await Vote.execute(signers[4], {
      initialFields: {
          votingBox: votingBoxId,
          vote: true,
          amount: 1n,
          daoToken: MockDAOTokenInstanceVar.contractId
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT * 2n,
      tokens: [{id: MockDAOTokenInstanceVar.contractId, amount: 1n}]
    })

    const fields = (await VotingBoxInstanceVar.fetchState()).fields

    const proposalAccepted = (await VotingBox.tests.isProposalAccepted({
      initialFields: {
        voteTokenId: fields.voteTokenId,
        quorum: fields.quorum,
        votingStart: fields.votingStart,
        votingEnd: fields.votingEnd,
        votesYes: fields.votesYes,
        votesNo: fields.votesNo
      },
      address: VotingBoxInstanceVar.address, 
      blockTimeStamp: Number(fields.votingEnd + 86500n),
    })).returns

    //Debug
    //console.log('quorum: ', fields.quorum)
    //console.log('votingStart: ', fields.votingStart)
    //console.log('votingEnd: ', fields.votingEnd)
    //console.log('votesYes: ', fields.votesYes)
    //console.log('votesNo: ', fields.votesNo)

    expect(proposalAccepted).toBeFalsy()

    //1st user cancel
    let balanceBefore = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[0].address)
    const fieldsBefore = (await VotingBoxInstanceVar.fetchState()).fields

    await CancelVote.execute(signers[0], {
      initialFields: {
          votingBox: votingBoxId,
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT,
    })

    let balanceAfter = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[0].address)
    let balanceDifference = balanceAfter - balanceBefore

    const fieldsAfter = (await VotingBoxInstanceVar.fetchState()).fields

    expect(balanceAfter).toEqual(10n)
    expect(fieldsAfter.votesYes).toEqual(fieldsBefore.votesYes - balanceDifference)
    expect(fieldsAfter.votesYes).toBeLessThan(fieldsBefore.votesYes)

  
    //2nd user cancel
    let balanceBefore2 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[1].address)
    const fieldsBefore2 = (await VotingBoxInstanceVar.fetchState()).fields

    await CancelVote.execute(signers[1], {
      initialFields: {
          votingBox: votingBoxId,
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT,
    })

    let balanceAfter2 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[1].address)
    let balanceDifference2 = balanceAfter2 - balanceBefore2

    const fieldsAfter2 = (await VotingBoxInstanceVar.fetchState()).fields

    expect(balanceAfter2).toEqual(10n)
    expect(fieldsAfter2.votesNo).toEqual(fieldsBefore2.votesNo - balanceDifference2)
    expect(fieldsAfter2.votesNo).toBeLessThan(fieldsBefore2.votesNo)

    //3rd user cancel
    let balanceBefore3 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[2].address)
    const fieldsBefore3 = (await VotingBoxInstanceVar.fetchState()).fields
  
    await CancelVote.execute(signers[2], {
      initialFields: {
          votingBox: votingBoxId,
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT,
    })
  
    let balanceAfter3 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[2].address)
    let balanceDifference3 = balanceAfter3 - balanceBefore3
  
    const fieldsAfter3 = (await VotingBoxInstanceVar.fetchState()).fields
  
    expect(balanceAfter3).toEqual(10n)
    expect(fieldsAfter3.votesNo).toEqual(fieldsBefore3.votesNo - balanceDifference3)
    expect(fieldsAfter3.votesNo).toBeLessThan(fieldsBefore3.votesNo)


    //4th user cancel
    let balanceBefore4 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[3].address)
    const fieldsBefore4 = (await VotingBoxInstanceVar.fetchState()).fields
  
    await CancelVote.execute(signers[3], {
      initialFields: {
          votingBox: votingBoxId,
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT,
    })
  
    let balanceAfter4 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[3].address)
    let balanceDifference4 = balanceAfter4 - balanceBefore4
  
    const fieldsAfter4 = (await VotingBoxInstanceVar.fetchState()).fields
  
    expect(balanceAfter4).toEqual(10n)
    expect(fieldsAfter4.votesNo).toEqual(fieldsBefore4.votesNo - balanceDifference4)
    expect(fieldsAfter4.votesNo).toBeLessThan(fieldsBefore4.votesNo)

    //5th user cancel
    let balanceBefore5 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[4].address)
    const fieldsBefore5 = (await VotingBoxInstanceVar.fetchState()).fields

    await CancelVote.execute(signers[4], {
      initialFields: {
          votingBox: votingBoxId,
      },
      attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT,
    })

    let balanceAfter5 = await balanceOf(MockDAOTokenInstanceVar.contractId, signers[0].address)
    let balanceDifference5 = balanceAfter5 - balanceBefore5

    const fieldsAfter5 = (await VotingBoxInstanceVar.fetchState()).fields

    expect(balanceAfter5).toEqual(10n)
    expect(fieldsAfter5.votesYes).toEqual(fieldsBefore5.votesYes - balanceDifference5)
    expect(fieldsAfter5.votesYes).toBeLessThan(fieldsBefore5.votesYes)


    //Final check
    const fieldsFinal = (await VotingBoxInstanceVar.fetchState()).fields
    expect(fieldsFinal.votesYes).toEqual(0n)
    expect(fieldsFinal.votesNo).toEqual(0n)

  })

})