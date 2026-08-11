import blockchain_service as bcs
from database import db
from datetime import datetime

alloc = db.budget_allocations.find_one({'allocation_id': 'ALLOC-2026-27-VA948R'})
transfer = db.state_transfers.find_one({'transfer_id': 'TRF-ST-KA-9EG26H'})

if alloc:
    tx_alloc = '2d962f943401372fcb1b83e789255dc050b89b321834d72d943394e4fac82ec2'
    db.budget_allocations.update_one(
        {'_id': alloc['_id']},
        {'$set': {'blockchain_tx_hash': tx_alloc, 'blockchain_block': 6}}
    )
    db.blockchain_transactions.update_one(
        {'tx_hash': tx_alloc},
        {'$set': {
            'tx_hash': tx_alloc,
            'block_number': 6,
            'operation_type': 'CENTRAL_BUDGET_ALLOCATION',
            'entity_id': alloc['allocation_id'],
            'from_address': bcs.get_account().address,
            'to_address': '0xFinanceDisbursalAuthority',
            'amount': alloc['amount'],
            'details': 'Budget Sanctioned for ' + str(alloc.get('scheme_name')) + ' (' + str(alloc.get('department')) + ')',
            'timestamp': datetime.utcnow()
        }},
        upsert=True
    )
    print('Allocation synced!')

if transfer and alloc:
    receipt_trf = bcs.record_state_transfer_onchain(
        transfer['transfer_id'],
        alloc['allocation_id'],
        transfer['state_name'],
        transfer['amount']
    )
    print('State Transfer On-Chain Tx:', receipt_trf)

    db.state_transfers.update_one(
        {'_id': transfer['_id']},
        {'$set': {
            'blockchain_tx_hash': receipt_trf['tx_hash'],
            'blockchain_block': receipt_trf['block_number']
        }}
    )
    db.blockchain_transactions.update_one(
        {'tx_hash': receipt_trf['tx_hash']},
        {'$set': {
            'tx_hash': receipt_trf['tx_hash'],
            'block_number': receipt_trf['block_number'],
            'operation_type': 'STATE_TRANSFER',
            'entity_id': transfer['transfer_id'],
            'from_address': bcs.get_account().address,
            'to_address': '0xStateTreasury_' + str(transfer.get('state_code')),
            'amount': transfer['amount'],
            'details': 'State Treasury Disbursal for ' + str(transfer.get('state_name')) + ' (' + str(alloc.get('scheme_name')) + ')',
            'timestamp': datetime.utcnow()
        }},
        upsert=True
    )
    print('State Transfer synced!')
