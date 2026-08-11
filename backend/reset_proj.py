from database import db
db.projects.update_one({'project_id': 'PRJ-BEN-YFIPCM'}, {'$set': {'contractor_id': None, 'contractor_name': None, 'status': 'CREATED'}})
print('Project reset to CREATED state!')
