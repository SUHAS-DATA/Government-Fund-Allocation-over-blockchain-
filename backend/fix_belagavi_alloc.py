from database import db
from bson import ObjectId

# 1. Update the Smart Schools allocation to Belagavi
res1 = db.district_allocations.update_one(
    {'_id': ObjectId('6a78a8e7ee66c66445cb23d8')},
    {'$set': {
        'district_name': 'Belagavi',
        'district_alloc_id': 'DIST-ALC-BEL-4MEOFB'
    }}
)
print("Updated district allocation:", res1.modified_count)

# 2. Update the notification
msg = "District Allocation DIST-ALC-BEL-4MEOFB for INR 15,000,000.00 under 'Smart Schools Digital Transformation Scheme' received."
res2 = db.notifications.update_one(
    {'link': {'$regex': '4MEOFB'}},
    {'$set': {
        'recipient_district': 'Belagavi',
        'message': msg,
        'link': '/district/projects?district_alloc_id=DIST-ALC-BEL-4MEOFB'
    }}
)
print("Updated notification:", res2.modified_count)

# 3. Remove the temporary dummy PMGSY allocation
res3 = db.district_allocations.delete_one({'district_alloc_id': 'DIST-ALC-BEL-K829XA'})
print("Deleted dummy PMGSY allocation:", res3.deleted_count)

# 4. Correct TRF-ST-KA-9EG26H allocated_to_districts
db.state_transfers.update_one(
    {'transfer_id': 'TRF-ST-KA-9EG26H'},
    {'$set': {'allocated_to_districts': 20000000.0}}
)

print("Fix completed successfully!")
