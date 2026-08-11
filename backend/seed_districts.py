from database import db
from datetime import datetime

districts_by_state = [
    {
        "state_code": "KA",
        "state_name": "Karnataka",
        "districts": [
            "Bengaluru Urban", "Bengaluru Rural", "Belagavi", "Mysuru", 
            "Mangaluru (Dakshina Kannada)", "Hubballi-Dharwad", "Kalaburagi", 
            "Shivamogga", "Ballari", "Udupi", "Tumakuru", "Davanagere", 
            "Hassan", "Mandya", "Bidar", "Raichur", "Vijayapura", "Bagalkote", 
            "Chitradurga", "Kolar", "Chikkamagaluru", "Kodagu", "Uttara Kannada", 
            "Ramanagara", "Chikkaballapura", "Koppal", "Gadag", "Haveri", 
            "Yadgir", "Chamarajanagar", "Vijayanagara"
        ]
    },
    {
        "state_code": "MH",
        "state_name": "Maharashtra",
        "districts": [
            "Pune", "Mumbai Suburban", "Mumbai City", "Nagpur", "Thane", "Nashik",
            "Aurangabad (Chhatrapati Sambhajinagar)", "Kolhapur", "Solapur", "Amravati",
            "Navi Mumbai", "Nanded", "Jalgaon", "Akola", "Latur", "Dhule", "Ahmednagar",
            "Satara", "Ratnagiri", "Raigad", "Sangli", "Chandrapur", "Parbhani", "Jalna",
            "Beed", "Yavatmal", "Wardha", "Bhandara", "Gondia", "Buldhana",
            "Osmanabad (Dharashiv)", "Nandurbar", "Washim", "Hingoli", "Gadchiroli",
            "Palghar", "Sindhudurg"
        ]
    },
    {
        "state_code": "GJ",
        "state_name": "Gujarat",
        "districts": [
            "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar",
            "Jamnagar", "Junagadh", "Anand", "Bharuch", "Mehsana", "Kutch", "Navsari",
            "Valsad", "Porbandar", "Morbi", "Patan", "Surendranagar", "Banaskantha",
            "Sabarkantha", "Panchmahal", "Dahod", "Amreli", "Gir Somnath", "Botad",
            "Devbhumi Dwarka", "Aravalli", "Chhota Udaipur", "Mahisagar", "Tapi",
            "Narmada", "Dang"
        ]
    },
    {
        "state_code": "TN",
        "state_name": "Tamil Nadu",
        "districts": [
            "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
            "Vellore", "Erode", "Tiruppur", "Thanjavur", "Dindigul", "Kanchipuram",
            "Cuddalore", "Thoothukudi", "Kanyakumari", "Karur", "Krishnagiri",
            "Dharmapuri", "Namakkal", "Pudukkottai", "Sivaganga", "Ramanathapuram",
            "Virudhunagar", "Theni", "Nilgiris", "Tiruvallur", "Tiruvannamalai",
            "Viluppuram", "Ranipet", "Tirupathur", "Chengalpattu", "Kallakurichi",
            "Tenkasi", "Mayiladuthurai"
        ]
    },
    {
        "state_code": "UP",
        "state_name": "Uttar Pradesh",
        "districts": [
            "Lucknow", "Kanpur Nagar", "Varanasi", "Agra", "Prayagraj (Allahabad)",
            "Noida (Gautam Buddha Nagar)", "Ghaziabad", "Meerut", "Gorakhpur", "Bareilly",
            "Aligarh", "Moradabad", "Saharanpur", "Jhansi", "Mathura", "Ayodhya (Faizabad)",
            "Muzaffarnagar", "Firozabad", "Budaun", "Rampur", "Shahjahanpur",
            "Farrukhabad", "Hapur", "Etawah", "Mirzapur", "Bulandshahr", "Sambhal",
            "Amroha", "Hardoi", "Fatehpur", "Raebareli", "Orai (Jalaun)", "Sitapur",
            "Bahraich", "Unnao", "Jaunpur", "Lakhimpur Kheri", "Hathras", "Banda",
            "Pilibhit", "Barabanki", "Sultanpur", "Basti", "Gonda", "Ballia", "Deoria",
            "Ghazipur", "Bijnor", "Mainpuri", "Lalitpur"
        ]
    },
    {
        "state_code": "TG",
        "state_name": "Telangana",
        "districts": [
            "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Rangareddy",
            "Medchal-Malkajgiri", "Sangareddy", "Nalgonda", "Mahabubnagar", "Siddipet",
            "Suryapet", "Mancherial", "Adilabad", "Jagtial", "Nirmal", "Kamareddy",
            "Wanaparthy", "Nagarkurnool", "Jangaon", "Bhadradri Kothagudem"
        ]
    },
    {
        "state_code": "RJ",
        "state_name": "Rajasthan",
        "districts": [
            "Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Bhilwara",
            "Alwar", "Sikar", "Sri Ganganagar", "Pali", "Bharatpur", "Chittorgarh",
            "Barmer", "Jhunjhunu", "Hanumangarh", "Nagaur", "Tonk", "Sawai Madhopur",
            "Dausa", "Bundi", "Rajsamand", "Jhalawar", "Dungarpur", "Banswara",
            "Sirohi", "Jaisalmer", "Dholpur", "Baran", "Pratapgarh", "Karauli", "Jalore"
        ]
    },
    {
        "state_code": "WB",
        "state_name": "West Bengal",
        "districts": [
            "Kolkata", "Howrah", "North 24 Parganas", "South 24 Parganas", "Darjeeling",
            "Siliguri", "Paschim Medinipur", "Purba Medinipur", "Hooghly", "Murshidabad",
            "Nadia", "Purba Bardhaman", "Paschim Bardhaman", "Malda", "Jalpaiguri",
            "Birbhum", "Bankura", "Purulia", "Cooch Behar", "Uttar Dinajpur",
            "Dakshin Dinajpur", "Alipurduar", "Kalimpong", "Jhargram"
        ]
    }
]

total_seeded = 0
for group in districts_by_state:
    st_code = group["state_code"]
    st_name = group["state_name"]
    for dist_name in group["districts"]:
        doc = {
            "name": dist_name,
            "state_code": st_code,
            "state_name": st_name,
            "treasury_address": f"0xDistrictTreasury_{st_code}_{dist_name.replace(' ', '')[:10]}",
            "created_at": datetime.utcnow()
        }
        db.districts.update_one({"name": dist_name, "state_code": st_code}, {"$set": doc}, upsert=True)
        total_seeded += 1

print(f"[SUCCESS] Seeded {total_seeded} districts cleanly mapped to their corresponding states.")
