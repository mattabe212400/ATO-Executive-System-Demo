/* ATO Executive System — Live Demo. Seeds fictional data, auto-signs in as a fixed persona, and
   never talks to a real backend. js/firebase.js is never loaded and js/data.js's Firestore
   functions all self-guard on _db/_fbFns being null (see js/data.js) — so this file doesn't need
   to override/no-op anything from data.js. It only needs to populate D{} directly, set
   CURRENT_USER/CURRENT_CHAPTER, and skip the app past the login gate. Loaded last (see
   index.html's script order) so nothing above it needs to know it's running in demo mode. */

// ══════════════════════════════════════════════
// SEED DATA
// ══════════════════════════════════════════════
function loadDemoData(){
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const past = n => fmt(new Date(today - n*86400000));
  const future = n => fmt(new Date(today.getTime() + n*86400000));
  const rid = () => 'demo_' + Math.random().toString(36).slice(2,10);

  // ── MEMBERS (18 fake members — covers every officer position at least once) ──
  const members = [
    {id:'m01',name:'James Mitchell',initials:'JM',role:'President',classYear:'Senior',year:2025,liveIn:true,memberStatus:'Active'},
    {id:'m02',name:'Ryan Torres',initials:'RT',role:'Vice President',classYear:'Senior',year:2025,liveIn:true,memberStatus:'Active'},
    {id:'m03',name:'Connor Walsh',initials:'CW',role:'Treasurer',classYear:'Junior',year:2026,liveIn:false,memberStatus:'Active'},
    {id:'m04',name:'Daniel Park',initials:'DP',role:'Secretary',classYear:'Junior',year:2026,liveIn:true,memberStatus:'Active'},
    {id:'m05',name:'Alex Rivera',initials:'AR',role:'Recruitment',classYear:'Junior',year:2026,liveIn:false,memberStatus:'Active'},
    {id:'m06',name:'Marcus Bell',initials:'MB',role:'Risk Manager',classYear:'Senior',year:2025,liveIn:true,memberStatus:'Active'},
    {id:'m07',name:'Tyler Brooks',initials:'TB',role:'Scholarship',classYear:'Sophomore',year:2027,liveIn:false,memberStatus:'Active'},
    {id:'m08',name:'Jordan Hayes',initials:'JH',role:'Philanthropy',classYear:'Junior',year:2026,liveIn:false,memberStatus:'Active'},
    {id:'m09',name:'Nathan Scott',initials:'NS',role:'Social',classYear:'Sophomore',year:2027,liveIn:true,memberStatus:'Active'},
    {id:'m10',name:'Ethan Cole',initials:'EC',role:'Public Relations',classYear:'Sophomore',year:2027,liveIn:false,memberStatus:'Active'},
    {id:'m11',name:'Logan Price',initials:'LP',role:'Member',classYear:'Sophomore',year:2027,liveIn:false,memberStatus:'New Member'},
    {id:'m12',name:'Blake Foster',initials:'BF',role:'Member',classYear:'Freshman',year:2028,liveIn:false,memberStatus:'New Member'},
    {id:'m13',name:'Owen Reed',initials:'OR',role:'Member',classYear:'Freshman',year:2028,liveIn:false,memberStatus:'New Member'},
    {id:'m14',name:'Caleb Hughes',initials:'CH',role:'House Manager',classYear:'Junior',year:2026,liveIn:true,memberStatus:'Active'},
    {id:'m15',name:'Brody Clark',initials:'BC',role:'Community Service',classYear:'Senior',year:2025,liveIn:false,memberStatus:'Active'},
    {id:'m16',name:'Mason Evans',initials:'ME',role:'Membership Educator',classYear:'Senior',year:2025,liveIn:true,memberStatus:'Active'},
    {id:'m17',name:'Hunter James',initials:'HJ',role:'Chaplain',classYear:'Junior',year:2026,liveIn:false,memberStatus:'Active'},
    {id:'m18',name:'Drew Santos',initials:'DS',role:'Alumni',classYear:'Senior',year:2025,liveIn:false,memberStatus:'Active'},
  ];

  // ── EVENTS (past mandatory + upcoming) ──
  const events = [
    {id:'e01',title:'Chapter Meeting',type:'chapter',date:past(42),start:'19:00',location:'Chapter House',mandatory:true},
    {id:'e02',title:'Chapter Meeting',type:'chapter',date:past(28),start:'19:00',location:'Chapter House',mandatory:true},
    {id:'e03',title:'Chapter Meeting',type:'chapter',date:past(14),start:'19:00',location:'Chapter House',mandatory:true},
    {id:'e04',title:'Chapter Meeting',type:'chapter',date:past(7),start:'19:00',location:'Chapter House',mandatory:true},
    {id:'e05',title:'Risk Management Workshop',type:'chapter',date:past(35),start:'18:00',location:'Student Union',mandatory:true},
    {id:'e06',title:'New Member Education',type:'chapter',date:past(21),start:'20:00',location:'Chapter House',mandatory:true},
    {id:'e07',title:'Philanthropy 5K Run',type:'philanthropy',date:past(10),start:'09:00',location:'Campus Rec',mandatory:false,fundGoal:1000,org:'Local Food Bank',notes:'Annual 5K benefiting the local food bank.'},
    {id:'e08',title:'Brotherhood Retreat',type:'brotherhood',chEventType:'retreat',date:past(5),start:'10:00',location:'State Park',mandatory:false,planningStatus:'completed',estCost:800,owner:'m17'},
    {id:'e09',title:'Chapter Meeting',type:'chapter',date:future(7),start:'19:00',location:'Chapter House',mandatory:true},
    {id:'e10',title:'Spring Formal',type:'social',date:future(14),start:'19:00',location:'Grand Ballroom',mandatory:false},
    {id:'e11',title:'Recruitment Kickoff',type:'recruitment',date:future(3),start:'17:00',location:'Chapter House',mandatory:false},
    {id:'e12',title:'Alumni Golf Outing',type:'chapter',date:future(21),start:'08:00',location:'Riverside Golf Club',mandatory:false},
    {id:'e13',title:'IFC Philanthropy Walk',type:'philanthropy',date:future(28),start:'11:00',location:'Main Quad',mandatory:false,fundGoal:800,org:'IFC Philanthropy Fund',notes:''},
    {id:'e14',title:'Exec Meeting',type:'exec',date:future(2),start:'18:00',location:'Chapter House',mandatory:false},
    {id:'e15',title:'Fall Mixer with Kappa Delta',type:'social',date:past(18),start:'20:00',location:'Chapter House',mandatory:false},
    {id:'e16',title:'Date Party',type:'social',date:future(35),start:'19:30',location:'The Lakehouse',mandatory:false},
    {id:'e17',title:'Food Bank Volunteer Day',type:'service',date:past(25),start:'10:00',location:'Downtown Food Bank',mandatory:false,hourGoal:40,org:'Local Food Bank',notes:'Monthly volunteering at the campus-adjacent food bank.'},
    {id:'e18',title:'Habitat for Humanity Build',type:'service',date:future(12),start:'09:00',location:'Habitat Build Site',mandatory:false,hourGoal:30,org:'Habitat for Humanity',notes:''},
    {id:'e19',title:'Spring Fundraiser Gala',type:'fundraiser',date:future(45),start:'19:00',location:'Grand Ballroom',mandatory:false,fundGoal:2000,org:'Chapter Scholarship Fund',notes:'Annual gala raising funds for the chapter scholarship.'},
    {id:'ce01',title:'Movie Night',type:'brotherhood',chEventType:'movie',date:past(14),start:'20:00',location:'Chapter House',mandatory:false,estCost:60,planningStatus:'completed',owner:'m17',notes:'',reflection:'Great turnout, low cost.'},
    {id:'ce02',title:'Golf Outing',type:'brotherhood',chEventType:'golf',date:past(30),start:'09:00',location:'Riverside Golf Club',mandatory:false,estCost:350,planningStatus:'completed',owner:'m17',notes:'',reflection:'Great weather, everyone had fun.'},
    {id:'ce03',title:'Bags Tournament',type:'brotherhood',chEventType:'bags',date:future(10),start:'14:00',location:'Chapter House',mandatory:false,estCost:75,planningStatus:'scheduled',owner:'m17',notes:'Bracket set, signage ordered.',reflection:''},
    {id:'ce04',title:'Brotherhood Retreat Planning',type:'brotherhood',chEventType:'retreat',date:future(25),start:'',location:'',mandatory:false,estCost:1200,planningStatus:'planning',owner:'m17',notes:'Comparing 2 cabin venues.',reflection:''},
    {id:'ce05',title:'Bowling Night',type:'brotherhood',chEventType:'custom',date:future(40),start:'',location:'',mandatory:false,estCost:null,planningStatus:'idea',owner:null,notes:'',reflection:''},
    // New Member Education sessions live on the shared calendar (type:'pledge'), same pattern
    // as Social/Philanthropy — see js/newmembereducation.js's nmeSessions().
    {id:'rs01',title:'New Member Orientation',type:'pledge',date:past(35),start:'',location:'',mandatory:false,facilitatorId:'m16',notes:'Chapter history, organization overview, expectations for the semester.'},
    {id:'rs02',title:'Ritual Book Session 1',type:'pledge',date:past(28),start:'',location:'',mandatory:false,facilitatorId:'m17',notes:'Introduction to the ritual book and its significance.'},
    {id:'rs03',title:'Risk Management & FIPG Training',type:'pledge',date:past(21),start:'',location:'',mandatory:false,facilitatorId:'m06',notes:'FIPG guidelines and chapter risk policy walkthrough.'},
    {id:'rs04',title:'Semester Wrap-Up & Reflection',type:'pledge',date:future(10),start:'',location:'',mandatory:false,facilitatorId:'m16',notes:'Reflect on the semester and preview what full membership looks like.'},
  ];

  // ── ATTENDANCE ──
  const mandEvIds = ['e01','e02','e03','e04','e05','e06'];
  const attendance = {};
  const attRates = {m01:1,m02:1,m03:.83,m04:1,m05:.83,m06:1,m07:.67,m08:.83,m09:.5,m10:.67,m11:.83,m12:.5,m13:.33,m14:1,m15:.67,m16:1,m17:.83,m18:.67};
  mandEvIds.forEach(evId=>{
    attendance[evId]={};
    members.forEach(m=>{
      const r = attRates[m.id] || 0.75;
      attendance[evId][m.id] = Math.random() < r ? 'present' : (Math.random() < .3 ? 'excused' : 'absent');
    });
    if(['e01','e02','e03'].includes(evId)){
      ['m01','m02','m03','m04'].forEach(id=>{ attendance[evId][id]='present'; });
    }
  });

  // ── TASKS — assignedTo/positionTitle are POSITION TITLES (assigned-by / assigned-to), not
  // member ids, matching the real system's shape (see js/events.js addTaskCore). ──
  const sem = getSemester();
  const tasks = [
    {id:'t01',title:'Submit IFC compliance report',assignedTo:'President',positionTitle:'Vice President',priority:'urgent',status:'todo',dueDate:future(2),desc:'Annual IFC safety and risk management compliance report due to Greek Life office.',committeeId:null,semester:sem},
    {id:'t02',title:'Update chapter budget spreadsheet',assignedTo:'President',positionTitle:'Treasurer',priority:'high',status:'in_progress',dueDate:future(5),desc:'Q2 budget vs actuals, including Spring Formal expenses.',committeeId:null,semester:sem},
    {id:'t03',title:'Draft recruitment email sequence',assignedTo:'Vice President',positionTitle:'Recruitment',priority:'high',status:'in_progress',dueDate:future(4),desc:'3-email outreach sequence for Fall rush prospects.',committeeId:null,semester:sem},
    {id:'t04',title:'Book venue for Spring Formal',assignedTo:'Vice President',positionTitle:'Social',priority:'high',status:'done',dueDate:past(3),desc:'',committeeId:null,semester:sem},
    {id:'t05',title:'Collect outstanding dues (4 members)',assignedTo:'President',positionTitle:'Treasurer',priority:'medium',status:'in_progress',dueDate:future(7),desc:'',committeeId:null,semester:sem},
    {id:'t06',title:'Schedule new member education sessions',assignedTo:'Vice President',positionTitle:'Membership Educator',priority:'medium',status:'todo',dueDate:future(10),desc:'',committeeId:null,semester:sem},
    {id:'t07',title:'Coordinate with philanthropy partner',assignedTo:'President',positionTitle:'Philanthropy',priority:'medium',status:'done',dueDate:past(7),desc:'',committeeId:null,semester:sem},
    {id:'t08',title:'Update chapter website',assignedTo:'Vice President',positionTitle:'Public Relations',priority:'low',status:'todo',dueDate:future(14),desc:'',committeeId:null,semester:sem},
    {id:'t09',title:'Prepare scholarship report for nationals',assignedTo:'President',positionTitle:'Scholarship',priority:'high',status:'todo',dueDate:past(2),desc:'Overdue. GPA data needs to be compiled and submitted.',committeeId:null,semester:sem},
    {id:'t10',title:'Book DJ for Spring Formal',assignedTo:'Vice President',positionTitle:'Social',priority:'medium',status:'done',dueDate:past(5),desc:'',committeeId:null,semester:sem},
    {id:'t11',title:'Post chapter meeting minutes',assignedTo:'Vice President',positionTitle:'Secretary',priority:'medium',status:'done',dueDate:past(6),desc:'',committeeId:null,semester:sem},
    {id:'t12',title:'Alumni newsletter draft',assignedTo:'President',positionTitle:'Alumni',priority:'low',status:'in_progress',dueDate:future(12),desc:'',committeeId:null,semester:sem},
  ];

  // ── GOALS — Semester Goals are a defined statement, not a progress tracker: the measurable
  // outcome lives inside the goal text itself (no separate target/current/unit). Spread across 9
  // positions so the President/VP chapter-wide card grid has real density to demonstrate, with
  // Treasurer intentionally left at exactly one goal and Membership Educator/Recruitment each at
  // exactly three, per the redesign's demo-data spec. ──
  const goals = [
    {id:'g01',title:'Increase formal chapter attendance to at least 75% this semester',positionTitle:'President',semester:sem},
    {id:'g02',title:'Maintain a chapter cumulative GPA above 3.2',positionTitle:'President',semester:sem},
    {id:'g03',title:'Complete the IFC risk-management compliance report on time',positionTitle:'Vice President',semester:sem},
    {id:'g04',title:'Hold a monthly officer accountability review with every position',positionTitle:'Vice President',semester:sem},
    {id:'g05',title:'Collect at least 95% of member dues by the semester deadline',positionTitle:'Treasurer',semester:sem},
    {id:'g06',title:'Sign at least 50 new members through informal recruitment',positionTitle:'Recruitment',semester:sem},
    {id:'g07',title:'Sign at least three new members through formal recruitment',positionTitle:'Recruitment',semester:sem},
    {id:'g08',title:'Build a pipeline of at least 10 qualified leads for the next recruitment team',positionTitle:'Recruitment',semester:sem},
    {id:'g09',title:'Achieve at least 90% new-member class retention',positionTitle:'Membership Educator',semester:sem},
    {id:'g10',title:'Achieve a new-member class cumulative GPA of at least 3.2',positionTitle:'Membership Educator',semester:sem},
    {id:'g11',title:'Complete at least 400 community-service hours as a new-member class',positionTitle:'Membership Educator',semester:sem},
    {id:'g12',title:'Raise at least $5,000 for the national philanthropy this semester',positionTitle:'Philanthropy',semester:sem},
    {id:'g13',title:'Host at least three philanthropy fundraising events this semester',positionTitle:'Philanthropy',semester:sem},
    {id:'g14',title:'Host at least 6 chapter social events this semester',positionTitle:'Social',semester:sem},
    {id:'g15',title:'Grow the chapter Instagram audience to at least 2,750 followers',positionTitle:'Social',semester:sem},
    {id:'g16',title:'Increase participation in Green Dot bystander-intervention training to at least 75% of members',positionTitle:'Risk Manager',semester:sem},
    {id:'g17',title:'Complete a risk-management walkthrough before every registered social event',positionTitle:'Risk Manager',semester:sem},
    {id:'g18',title:'Send an alumni newsletter at least twice this semester',positionTitle:'Alumni',semester:sem},
    {id:'g19',title:'Grow the verified alumni contact list to at least 400 alumni',positionTitle:'Alumni',semester:sem},
  ];

  // ── NOTES ──
  const notes = [
    {id:'n01',title:'Chapter Meeting: Week 8',type:'chapter',date:past(7),author:'m04',
     announcements:'Spring Formal tickets on sale. Brotherhood retreat debrief shared.\nIFC compliance deadline is next week. VP following up.',
     oldBusiness:'Dues collection at 87%. Treasurer sending final reminder this week.',
     newBusiness:'Recruitment kickoff event approved for '+future(3)+'. Risk Manager to file event approval.',
     actions:['VP to submit IFC compliance report by '+future(2),'Treasurer to finalize dues list','Recruitment to send kickoff invitations'],
     ooh:'Alex Rivera',botw:'Connor Walsh',buffon:'Logan Price',
     officerReports:[
       {role:'President',name:'James Mitchell',notes:'Met with Greek Life advisor. Chapter in good standing. Nationals visit scheduled for next month.'},
       {role:'Vice President',name:'Ryan Torres',notes:'IFC compliance report in progress. Due '+future(2)+'. Risk workshop attendance was 94%.'},
       {role:'Treasurer',name:'Connor Walsh',notes:'Budget is on track. 4 members still owe semester dues. Spring Formal deposit paid.'},
       {role:'Recruitment',name:'Alex Rivera',notes:'14 rushees in pipeline. 6 are bid-ready. Kickoff event planning underway.'},
     ]},
    {id:'n02',title:'Exec Meeting: Spring Formal Planning',type:'exec',date:past(14),author:'m01',
     announcements:'Venue confirmed. Budget approved at $4,200.',
     oldBusiness:'DJ booked. Catering quotes received.',
     newBusiness:'Ticket pricing set at $35/person. Sales start Monday.',
     actions:['Social to open ticket sales','Treasurer to track ticket revenue'],
     officerReports:[]},
    {id:'n03',title:'Chapter Meeting: Week 6',type:'chapter',date:past(21),author:'m04',
     announcements:'Philanthropy 5K registration open. Brotherhood retreat details shared.',
     oldBusiness:'New member education program on track. 3 sessions completed.',
     newBusiness:'Alumni golf outing scheduled for '+future(21)+'. Alumni chair coordinating.',
     actions:['All members to register for 5K by end of week','Alumni to send golf outing invitations'],
     ooh:'Marcus Bell',botw:'Tyler Brooks',
     officerReports:[]},
  ];

  // ── JUDICIAL CASES (D.cases) — type is 'jb-hearing'|'membership-review' (see js/judicial.js's
  // jbCases/mrCases split), not a free-text category. ──
  const cases = [
    {id:'jc01',caseNum:'JB-2024-001',member:'m13',memberName:'Owen Reed',type:'jb-hearing',status:'open',
     bylaw:'Article II, Sec. 4: Attendance',contact:'',
     resolution:'',filedBy:'m04',filedByName:'Daniel Park',docs:[],semester:sem,hearingDate:future(5)},
    {id:'jc02',caseNum:'JB-2024-002',member:'m11',memberName:'Logan Price',type:'membership-review',status:'open',
     bylaw:'Article II, Sec. 1: Bad Financial Risk',contact:'',
     resolution:'',filedBy:'m03',filedByName:'Connor Walsh',docs:[],semester:sem,hearingDate:future(3)},
    {id:'jc03',caseNum:'JB-2023-008',member:'m15',memberName:'Brody Clark',type:'jb-hearing',status:'resolved',
     bylaw:'Article XII: Conduct',contact:'',
     resolution:'10 hours community service completed. Case closed.',filedBy:'m01',filedByName:'James Mitchell',docs:[],semester:sem,hearingDate:past(30)},
  ];

  // ── SOBER BROS — weekly weekend/day/slot grid ──
  const pledgeShadowStart = future(3);
  const shifts = {
    pledgeShadowStart,
    weekends: [
      { id:'sbw01', thuDate:past(11),
        days:{
          wed:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
          thu:{name:'',slotCount:3,memberIds:['m06','m10','m14'],pledgeIds:[]},
          fri:{name:'',slotCount:3,memberIds:['m05','m03','m08'],pledgeIds:[]},
          sat:{name:'Luau Party',slotCount:3,memberIds:['m02','m07','m16'],pledgeIds:[]},
          sun:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
        }
      },
      { id:'sbw02', thuDate:future(3),
        days:{
          wed:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
          thu:{name:'',slotCount:3,memberIds:['m06','m10',null],pledgeIds:['m11']},
          fri:{name:'',slotCount:3,memberIds:['m14','m03',null],pledgeIds:['m12','m13']},
          sat:{name:'Casino Night',slotCount:3,memberIds:['m02','m07',null],pledgeIds:[]},
          sun:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
        }
      },
      { id:'sbw03', thuDate:future(10),
        days:{
          wed:{name:'Pre-Formal Mixer',slotCount:2,memberIds:['m08','m16'],pledgeIds:[]},
          thu:{name:'',slotCount:3,memberIds:['m05','m06',null],pledgeIds:['m11']},
          fri:{name:'',slotCount:3,memberIds:['m03','m14',null],pledgeIds:['m12']},
          sat:{name:'Spring Formal',slotCount:4,memberIds:['m02','m07','m10','m17'],pledgeIds:[]},
          sun:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
        }
      },
    ]
  };

  // ── ACADEMICS ──
  const gpas = {
    m01:{cumulativeGpa:'3.72',priorGpa:'3.81',semesterGpa:'3.65'}, m02:{cumulativeGpa:'3.45',priorGpa:'3.50',semesterGpa:'3.40'},
    m03:{cumulativeGpa:'3.88',priorGpa:'3.92',semesterGpa:'3.85'}, m04:{cumulativeGpa:'3.21',priorGpa:'3.18',semesterGpa:'3.30'},
    m05:{cumulativeGpa:'3.05',priorGpa:'2.98',semesterGpa:'3.15'}, m06:{cumulativeGpa:'2.89',priorGpa:'2.75',semesterGpa:'3.00'},
    m07:{cumulativeGpa:'3.94',priorGpa:'3.90',semesterGpa:'3.97'}, m08:{cumulativeGpa:'3.33',priorGpa:'3.40',semesterGpa:'3.28'},
    m09:{cumulativeGpa:'2.71',priorGpa:'2.65',semesterGpa:'2.78'}, m10:{cumulativeGpa:'2.55',priorGpa:'2.60',semesterGpa:'2.50'},
    m11:{cumulativeGpa:'3.10',priorGpa:'3.05',semesterGpa:'3.20'}, m12:{cumulativeGpa:'3.62',priorGpa:'',semesterGpa:'3.62'},
    m13:{cumulativeGpa:'2.40',priorGpa:'',semesterGpa:'2.40'}, m14:{cumulativeGpa:'3.55',priorGpa:'3.48',semesterGpa:'3.60'},
    m15:{cumulativeGpa:'2.95',priorGpa:'3.00',semesterGpa:'2.88'}, m16:{cumulativeGpa:'3.78',priorGpa:'3.82',semesterGpa:'3.74'},
    m17:{cumulativeGpa:'3.15',priorGpa:'3.10',semesterGpa:'3.22'}, m18:{cumulativeGpa:'3.40',priorGpa:'3.35',semesterGpa:'3.45'},
  };

  // ── FINANCE ──
  const duesInHouse=525, duesOutOfHouse=425, duesPledge=350;
  const dues = {};
  members.forEach((m,i)=>{
    const tier = (m.memberStatus||'Active')==='New Member' ? duesPledge : (m.liveIn ? duesInHouse : duesOutOfHouse);
    const paid = i < 14 ? tier : (i===14 ? Math.round(tier*0.47) : (i===15 ? 0 : tier));
    dues[m.id]={semesterDues:tier,paid,status:paid>=tier?'Paid':paid>0?'Partial':'Unpaid',fineCount:0};
  });
  const expenses = [
    {id:'ex01',desc:'Spring Formal venue deposit',category:'Events Social',amount:1200,date:past(18)},
    {id:'ex02',desc:'DJ booking, Spring Formal',category:'Events Social',amount:650,date:past(10)},
    {id:'ex03',desc:'Philanthropy 5K supplies',category:'Events Philanthropy',amount:280,date:past(12)},
    {id:'ex04',desc:'Chapter house cleaning supplies',category:'Housing Miscellaneous',amount:95,date:past(8)},
    {id:'ex05',desc:'New member welcome gifts',category:'Miscellaneous',amount:340,date:past(20)},
    {id:'ex06',desc:'IFC dues payment',category:'Administrative IFC Dues',amount:500,date:past(25)},
    {id:'ex07',desc:'Recruitment event supplies',category:'Miscellaneous',amount:175,date:past(3)},
  ];
  const fines = [
    {id:'fi01',memberId:'m09',amount:25,reason:'Missed mandatory event without excuse',date:past(6),paid:false},
    {id:'fi02',memberId:'m13',amount:50,reason:'Missed 3+ mandatory events',date:past(4),paid:false},
  ];

  // ── RECRUITMENT ──
  const rushees = [
    {id:'r01',name:'Jake Morrison',stage:'Bid Ready',major:'Business',hometown:'Chicago, IL',bidScore:88,recruiter:'m05',lastContact:past(1),eventsAttended:4,tags:['Leadership','Good Fit'],notes:'Strong candidate. President of high school student council. Great cultural fit.'},
    {id:'r02',name:'Tyler Nguyen',stage:'Bid Ready',major:'Engineering',hometown:'Dallas, TX',bidScore:82,recruiter:'m05',lastContact:past(2),eventsAttended:3,tags:['Academics','Good Fit']},
    {id:'r03',name:'Sam Elliott',stage:'Interviewed',major:'Finance',hometown:'Columbus, OH',bidScore:76,recruiter:'m14',lastContact:past(1),eventsAttended:3,tags:['Leadership']},
    {id:'r04',name:'Chris Patel',stage:'Bid Ready',major:'Pre-Med',hometown:'Atlanta, GA',bidScore:91,recruiter:'m05',lastContact:past(0),eventsAttended:5,tags:['Hot Prospect','Academics']},
    {id:'r05',name:'Derek Wilson',stage:'Active Rush',major:'Marketing',hometown:'Denver, CO',bidScore:65,recruiter:'m14',lastContact:past(3),eventsAttended:2,tags:['Social Fit']},
    {id:'r06',name:'Austin Lee',stage:'Active Rush',major:'Kinesiology',hometown:'Phoenix, AZ',bidScore:71,recruiter:'m05',lastContact:past(2),eventsAttended:2,tags:['Athlete','Good Fit']},
    {id:'r07',name:'Nate Cooper',stage:'Attended Event',major:'Computer Science',hometown:'Seattle, WA',bidScore:58,recruiter:'m14',lastContact:past(5),eventsAttended:1,tags:['Academics']},
    {id:'r08',name:'Josh Kim',stage:'Attended Event',major:'Communications',hometown:'Miami, FL',bidScore:54,recruiter:null,lastContact:past(7),eventsAttended:1,tags:[]},
    {id:'r09',name:'Will Patterson',stage:'Contacted',major:'Political Science',hometown:'Boston, MA',bidScore:45,recruiter:null,lastContact:past(6),eventsAttended:0,tags:[]},
    {id:'r10',name:'Ryan Chen',stage:'New Lead',major:'Accounting',hometown:'Portland, OR',bidScore:38,recruiter:null,lastContact:null,eventsAttended:0,tags:[]},
    {id:'r11',name:'Ben Harris',stage:'Bid Extended',major:'Architecture',hometown:'Nashville, TN',bidScore:84,recruiter:'m05',lastContact:past(1),eventsAttended:4,tags:['Good Fit','Leadership']},
    {id:'r12',name:'Cole Martinez',stage:'Accepted',major:'Business',hometown:'Austin, TX',bidScore:94,recruiter:'m14',lastContact:past(0),eventsAttended:6,tags:['Hot Prospect','Legacy']},
    {id:'r13',name:'Ian Foster',stage:'Accepted',major:'Finance',hometown:'St. Louis, MO',bidScore:87,recruiter:'m05',lastContact:past(0),eventsAttended:5,tags:['Good Fit']},
    {id:'r14',name:'Max Thompson',stage:'Active Rush',major:'Sports Management',hometown:'Indianapolis, IN',bidScore:68,recruiter:'m14',lastContact:past(4),eventsAttended:2,tags:['Athlete']},
  ];
  const rcEvents = [
    {id:'re01',name:'Meet the Brothers',date:future(3),time:'17:00',location:'Chapter House',type:'Social',rsvp:28,recruiters:['m05','m14']},
    {id:'re02',name:'Philanthropy Service Day',date:future(10),time:'10:00',location:'Food Bank',type:'Service',rsvp:12,recruiters:['m05']},
    {id:'re03',name:'Bid Night',date:future(17),time:'19:00',location:'Chapter House',type:'Bid Night',rsvp:null,recruiters:['m05','m14','m01']},
    {id:'re04',name:'Sports Night',date:past(8),time:'18:00',location:'Rec Center',type:'Social',rsvp:22,recruiters:['m05','m14']},
    {id:'re05',name:'Coffee Chat Series: Week 1',date:past(15),time:'15:00',location:'Campus Coffee Shop',type:'Informal',rsvp:8,recruiters:['m14']},
  ];

  // ── COMMITTEES — coEnsureDefaults() (js/committees.js) backfills icon/positions/roster ──
  const committees = [
    {id:'com01',name:'Risk Management Committee',desc:'Oversees event safety, social monitor scheduling, and policy compliance.',chair:'m06',members:['m06','m01','m02','m09']},
    {id:'com02',name:'Recruitment Committee',desc:'Plans and executes all rush events and manages the prospect pipeline.',chair:'m05',members:['m05','m14','m11','m12']},
    {id:'com03',name:'Philanthropy Committee',desc:'Organizes service events and manages fundraising initiatives.',chair:'m08',members:['m08','m10','m13','m17']},
    {id:'com04',name:'Scholarship Committee',desc:'Monitors academic standing and supports members on academic probation.',chair:'m07',members:['m07','m04','m16']},
  ];
  const committeeLeaders = [...new Set(committees.map(c=>c.chair).filter(Boolean))];

  // ── PHILANTHROPY (fundraising) ──
  const phFunds = [
    {id:rid(),amount:840,memberId:null,date:past(10),eventId:'e07',notes:'5K registration fees'},
    {id:rid(),amount:250,memberId:'m08',date:past(8),eventId:null,notes:'Individual donor'},
    {id:rid(),amount:180,memberId:null,date:past(27),eventId:'e13',notes:'IFC walk registration fees'},
  ];
  const phOrgs = [
    {id:rid(),name:'Local Food Bank',contact:'volunteer@localfoodbank.org',notes:'Primary philanthropy partner'},
    {id:rid(),name:'Chapter Scholarship Fund',contact:'',notes:'Internal scholarship fund for members'},
  ];
  const phVendors = [
    {id:rid(),name:'Campus Print Shop',contact:'orders@campusprint.com',contribution:'Discounted event flyers and banners'},
    {id:rid(),name:'Hometown Grocers',contact:'',contribution:'Donated $200 gift card for raffle'},
  ];

  // ── COMMUNITY SERVICE ──
  const csHours = members.slice(0,12).map((m,i)=>({id:rid(),memberId:m.id,hours:i<8?4:2,eventId:'e17',date:past(25),notes:''}));
  const csLocations = [
    {id:rid(),name:'Local Food Bank',address:'400 Center St',contactName:'Maria Lopez',contactInfo:'volunteer@localfoodbank.org',notes:'Regular Saturday shifts available'},
    {id:rid(),name:'Habitat for Humanity ReStore',address:'210 Industrial Pkwy',contactName:'',contactInfo:'',notes:''},
  ];

  // ── ALUMNI ──
  const alumni = {
    contacts:[
      {id:'al01',name:'Michael Thompson',gradYear:2019,employer:'Goldman Sachs',industry:'Finance',location:'New York, NY',engagement:'Active',email:'m.thompson@example.com'},
      {id:'al02',name:'David Chen',gradYear:2021,employer:'Google',industry:'Technology',location:'San Francisco, CA',engagement:'Active',email:'d.chen@example.com'},
      {id:'al03',name:'Kevin Murphy',gradYear:2017,employer:'McKinsey & Co',industry:'Consulting',location:'Chicago, IL',engagement:'Occasional'},
      {id:'al04',name:'Scott Williams',gradYear:2020,employer:'Deloitte',industry:'Consulting',location:'Dallas, TX',engagement:'Active'},
      {id:'al05',name:'Brian Rodriguez',gradYear:2022,employer:'JP Morgan',industry:'Finance',location:'New York, NY',engagement:'Occasional'},
    ],
    events:[
      {id:'alev01',title:'Alumni Golf Outing',date:future(21),type:'Social',location:'Riverside Golf Club',notes:'Annual alumni event. 24 RSVPs so far.'},
      {id:'alev02',title:'Homecoming Alumni Reception',date:past(60),type:'Networking',location:'Alumni Center',notes:'35 alumni attended. Great turnout.'},
    ],
    outreach:[
      {id:'alout01',alumniId:'al01',method:'LinkedIn',date:past(5),byId:'m18',notes:'Connected re: career panel for actives. He agreed to speak in April.'},
      {id:'alout02',alumniId:'al02',method:'Email',date:past(12),byId:'m18',notes:'Invited to golf outing. Confirmed attendance.'},
      {id:'alout03',alumniId:'al04',method:'Phone',date:past(20),byId:'m01',notes:'Discussed chapter update. Alumni gift pending.'},
    ],
  };

  // ── SETTINGS — a clearly fictional chapter identity, not any real chapter's data ──
  const settings = {
    name:'James Mitchell',year:2025,classYear:'Senior',
    notifAttendance:true,notifTasks:true,notifSober:true,notifWeekly:true,
    chapterName:'Epsilon Chapter',university:'Overlook State University',
    chapterSize:'18',chapterFounded:'1961',chapterEmail:'epsilon@ato-demo.example',
    duesInHouse,duesOutOfHouse,duesPledge,duesNational:100,
  };

  // ── TRANSITION HUB (per-position handoff docs) ──
  const transitions = [
    {id:'tr01',role:'President',outgoing:'m01',incoming:'m02',status:'in_progress',
     content:'Key priorities for incoming President:\n• Rebuild relationship with Greek Life advisor, schedule meeting in Week 1\n• The exec team responds to consistent accountability. Weekly 1-on-1s matter more than chapter meetings.\n• ATO national visit is in October. Make sure all compliance docs are current by September.',
     wishIKnew:'The job is 80% communication and follow-up. Set clear weekly expectations and never let a deadline slip twice. Your exec team will only move as fast as you hold them accountable.',
     contacts:[{name:'Dr. Sarah Kim',role:'Greek Life Advisor',email:'skim@overlookstate.edu',phone:'555-0101'},{name:'National Field Officer',role:'Nationals',email:'fieldofficer@ato.org',phone:'555-0199'}]},
    {id:'tr02',role:'Vice President',outgoing:'m02',incoming:'m05',status:'in_progress',
     content:'VP runs chapter meetings and tracks officer accountability. Key things:\n• Agenda template is saved in Files, use it every week\n• The weekly exec check-in on Monday is non-negotiable\n• Attendance warnings go through you before they go to JBoard',
     wishIKnew:'Agenda discipline makes or breaks chapter meetings. Send it 24 hours out, stick to time limits, never let open forum run more than 5 minutes.',
     contacts:[{name:'IFC Vice President',role:'IFC Executive',email:'ifc@overlookstate.edu',phone:'555-0102'}]},
    {id:'tr03',role:'Treasurer',outgoing:'m03',incoming:null,status:'review',
     content:'Budget spreadsheet is pinned in Files. Key handoff items:\n• IFC dues payment is due Week 2: do not miss it, late fees compound\n• 4 members still on partial payment plans; see finance tracker\n• Semester budget is at 73% spent with 4 weeks remaining',
     wishIKnew:'Chase dues early and often. The first 3 weeks set the tone. Members who don\'t pay by Week 4 rarely pay voluntarily.',
     contacts:[{name:'IFC Treasurer',role:'IFC',email:'treasurer@ifc.overlookstate.edu',phone:'555-0103'}]},
    {id:'tr04',role:'Secretary',outgoing:'m04',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr05',role:'Risk Manager',outgoing:'m06',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr06',role:'Recruitment',outgoing:'m05',incoming:null,status:'complete',
     content:'Full rushee CRM is live in the platform. Key handoff items:\n• 14 current rushees: 3 accepted, 3 bid-ready. Follow up before semester ends.\n• Rush event debrief doc is in Files\n• Recruiter performance data is in the Recruitment CRM → Overview tab',
     wishIKnew:'Relationships close bids, not events. Train every brother on how to have a conversation, not just a pitch.',
     contacts:[{name:'IFC Recruitment Director',role:'IFC',email:'recruitment@ifc.overlookstate.edu',phone:'555-0104'}]},
    {id:'tr07',role:'Scholarship',outgoing:'m07',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr08',role:'Philanthropy',outgoing:'m08',incoming:null,status:'complete',
     content:'Semester philanthropy wrap-up complete. Final hours: 312 chapter hours logged.\n• Food bank partnership renewed for next semester\n• 5K run raised $1,090 (surpassed the $1,000 goal)\n• IFC hours report submitted on time',
     wishIKnew:'Know the IFC minimum hours requirement on Day 1 and set your goal above it. Transportation is usually the biggest barrier to participation.',
     contacts:[{name:'Campus Food Bank',role:'Partner Org',email:'volunteer@foodbank.org',phone:'555-0150'}]},
    {id:'tr09',role:'Social',outgoing:'m09',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr10',role:'Chaplain',outgoing:'m17',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr11',role:'Membership Educator',outgoing:'m16',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr12',role:'Alumni',outgoing:'m18',incoming:null,status:'in_progress',
     content:'Alumni golf outing is in 3 weeks. Venue and catering are confirmed.\n• 24 alumni RSVPs so far. Call list for non-responders is in Files.\n• LinkedIn alumni network has 47 connected. Keep it updated after every outreach.',
     wishIKnew:'Alumni engagement compounds over time. A direct message from you beats a mass email every time. Stay personal.',
     contacts:[{name:'Alumni Association',role:'University',email:'alumni@overlookstate.edu',phone:'555-0200'}]},
    {id:'tr13',role:'Community Service',outgoing:'m15',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr14',role:'Public Relations',outgoing:'m10',incoming:null,status:'not_started',content:'',wishIKnew:'',contacts:[]},
    {id:'tr15',role:'House Manager',outgoing:'m14',incoming:null,status:'review',
     content:'House inspection checklist is in Files. Outstanding items:\n• HVAC unit in east wing needs service: contact Mark Briggs at house corp\n• Deck railing repair scheduled for spring break week\n• Room assignments for next semester need to be finalized by April 15',
     wishIKnew:'Build a relationship with house corp in Week 1. Keep a running maintenance log. It protects you when something goes wrong.',
     contacts:[{name:'Mark Briggs',role:'House Corporation',email:'mbriggs@housecorp.org',phone:'555-0300'}]},
  ];

  const transitionHub = {
    deadlines: [
      {id:'thd1',title:'Submit chapter roster to IFC',owner:'Secretary',when:'Week 1 of every semester',priority:'high',notes:'Late submission results in chapter fines.',done:false},
      {id:'thd2',title:'IFC dues payment',owner:'Treasurer',when:'Week 2 of every semester',priority:'high',notes:'Check IFC invoice for exact amount.',done:false},
      {id:'thd3',title:'ATO national member report',owner:'Secretary',when:'Week 3 of every semester',priority:'high',notes:'Submit via myATO portal.',done:true},
      {id:'thd4',title:'GPA collection from all members',owner:'Scholarship',when:'Weeks 2–4 each semester',priority:'high',notes:'Needed for IFC and national reporting.',done:false},
      {id:'thd5',title:'Semester budget submission',owner:'Treasurer',when:'Week 1 of every semester',priority:'high',notes:'Full budget presented at first exec meeting.',done:true},
      {id:'thd6',title:'Officer transition documents complete',owner:'Vice President',when:'Final 2 weeks of semester',priority:'high',notes:'All outgoing officers must complete before changeover.',done:false},
    ],
    issues: [
      {id:'thi1',title:'Chapter house HVAC needs inspection',priority:'high',notes:'Unit in east wing hasn\'t been serviced in 18 months. House corp contact is Mark Briggs. Get this done before summer.',owner:'House Manager',open:true},
      {id:'thi2',title:'IFC late filing from last semester: $150 fine outstanding',priority:'medium',notes:'Treasurer needs to pay this before new semester starts or it compounds.',owner:'Treasurer',open:true},
      {id:'thi3',title:'Two members on academic probation, need follow-up plan',priority:'high',notes:'Owen Reed and Ethan Cole. Both below 2.6 GPA. Scholarship to meet with them individually in first 2 weeks.',owner:'Scholarship',open:true},
    ],
    archive: [
      {id:'tha1',semester:'Fall 2023',summary:'Strong recruitment semester: 16 new members. Attendance averaged 88%. Spring Formal budget came in under by $400.',date:'2024-01-10'},
    ],
  };

  // ── HOUSE MANAGEMENT: meal crew schedule + chore assignments ──
  const liveInPool = ['m01','m02','m04','m06','m09','m14','m16'];
  const kcSchedule = {
    lunch:  { mon:['m01','m02'], tue:['m04','m06'], wed:['m09','m14'], thu:['m16','m01'], fri:['m02','m04'] },
    dinner: { mon:['m01','m02','m04','m06'], tue:['m09','m14','m16','m01'], wed:['m02','m04','m06','m09'], thu:['m14','m16','m01','m02'] },
  };
  const choresList = KC_DEFAULT_CHORES.map((c,i)=>({...c, memberIds:[liveInPool[i%liveInPool.length]]}));
  const choresChecks = {};
  choresList.forEach((c,i)=>{
    if((c.day==='both'||c.day==='tuesday'||c.day==='daily')&&i%3!==0) choresChecks[c.id+'_tue']=true;
    if((c.day==='both'||c.day==='thursday'||c.day==='daily')&&i%4===0) choresChecks[c.id+'_thu']=true;
  });

  // ── HOUSE LIFE (rooms/parking/priority-point rubric) — the rubric doesn't auto-seed like
  // Bible Study curriculum does, so it's populated here. ──
  const houseLife = {
    rooms: [
      {id:'rm01',floor:'2nd Floor',label:'Room 201',capacity:2,occupantIds:['m01','m02'],order:0},
      {id:'rm02',floor:'2nd Floor',label:'Room 202',capacity:2,occupantIds:['m06','m09'],order:1},
      {id:'rm03',floor:'2nd Floor',label:'Room 203',capacity:1,occupantIds:['m14'],order:2},
      {id:'rm04',floor:'3rd Floor',label:'Room 301',capacity:2,occupantIds:['m04','m16'],order:3},
      {id:'rm05',floor:'3rd Floor',label:'Room 302',capacity:2,occupantIds:[],order:4},
    ],
    parking: [
      {id:'pk01',label:'Spot 1',isReserved:true,assignedMemberId:'m01',assignedLabel:'James Mitchell',carModel:'Honda Civic',licensePlate:'',notes:'President, reserved',order:0},
      {id:'pk02',label:'Spot 2',isReserved:false,assignedMemberId:'m06',assignedLabel:'Marcus Bell',carModel:'Ford F-150',licensePlate:'',notes:'',order:1},
      {id:'pk03',label:'Spot 3',isReserved:false,assignedMemberId:null,assignedLabel:'',carModel:'',licensePlate:'',notes:'Open',order:2},
    ],
    prefCriteria: [
      {id:'pc01',label:'Semesters live-in',points:5,order:0,perUnit:true,unitLabel:'semester'},
      {id:'pc02',label:'Exec board position',points:10,order:1,perUnit:false},
      {id:'pc03',label:'Class year seniority',points:3,order:2,perUnit:true,unitLabel:'year'},
    ],
    prefScores: {
      m01:{[sem]:{checkedCriteria:['pc01','pc02'],adjustment:0,adjustmentNote:''}},
      m14:{[sem]:{checkedCriteria:['pc01'],adjustment:2,adjustmentNote:'Extra point for handling move-in logistics'}},
    },
  };

  D = {
    members, events, attendance, tasks, goals, notes,
    cases, shifts, transitions, committeeLeaders,
    academics: { gpas, history: [
      {semester:'Spring 2026',chapterGpa:'3.22',cumulativeChapterGpa:'3.26',memberCount:17,date:past(210)},
      {semester:'Fall 2026',chapterGpa:'3.28',cumulativeChapterGpa:'3.29',memberCount:18,date:past(20)},
    ] },
    finance: {
      dues, fines, expenses, plans: [],
      payments: [
        {id:'pay01',memberId:'m02',amount:425,type:'Semester Dues',method:'Venmo',date:past(2)},
        {id:'pay02',memberId:'m07',amount:425,type:'Semester Dues',method:'Check',date:past(4)},
        {id:'pay03',memberId:'m10',amount:425,type:'Semester Dues',method:'Zelle',date:past(5)},
        {id:'pay04',memberId:'m12',amount:350,type:'Semester Dues',method:'Venmo',date:past(7)},
        {id:'pay05',memberId:'m17',amount:425,type:'Semester Dues',method:'Cash',date:past(9)},
        {id:'pay06',memberId:'m15',amount:200,type:'Partial Dues',method:'Venmo',date:past(11)},
      ],
      nationalDues: {}, nationalPayments: [],
      // Example budget categories for demo purposes — not any specific chapter's real budget.
      budget: {'Housing Rent':8000,'Housing Maintenance':1200,'Housing Miscellaneous':600,'Utilities Electric':900,'Utilities Water & Trash':700,'Administrative IFC Dues':500,'Administrative Insurance':400,'Events Recruitment':800,'Events Social':2500,'Events Philanthropy':800,'Events Brotherhood':500,'Events Alumni':500,'Scholarship':600,'Risk Management':300,'Miscellaneous':500},
    },
    recruitment: { rushees, events: rcEvents, goal: {target:20,label:'New Members This Semester'} },
    committees,
    philanthropy: {fundraisingLogs:phFunds, organizations:phOrgs, vendors:phVendors, goals:{events:4,funds:2000}},
    communityService: {hours:csHours, locations:csLocations, goals:{totalHrs:500,events:6,avgHrs:4}},
    alumni,
    ritual: {
      items: [
        {id:'ri01',title:'Chapter History & Founding Principles',category:'education',week:1,required:true,desc:'Overview of national history and the chapter\'s founding.',done:true},
        {id:'ri02',title:'Ritual Book Introduction',category:'ritual',week:1,required:true,desc:'',done:true},
        {id:'ri03',title:'Risk Management & FIPG Training',category:'administrative',week:2,required:true,desc:'',done:true},
        {id:'ri04',title:'National Organization Structure',category:'education',week:2,required:true,desc:'',done:true},
        {id:'ri05',title:'Meet Your Peer Mentor',category:'brotherhood',week:2,required:false,desc:'',done:true},
        {id:'ri06',title:'Chapter Bylaws Review',category:'administrative',week:3,required:true,desc:'',done:true},
        {id:'ri07',title:'Community Service Project',category:'service',week:4,required:true,desc:'',done:true},
        {id:'ri08',title:'Brotherhood Retreat Attendance',category:'brotherhood',week:5,required:false,desc:'',done:false},
        {id:'ri09',title:'Standards Test',category:'education',week:6,required:true,desc:'',done:false},
        {id:'ri10',title:'Ritual Memorization',category:'ritual',week:6,required:true,desc:'',done:false},
        {id:'ri11',title:'Peer Mentor Group Reveal',category:'brotherhood',week:7,required:false,desc:'',done:false},
        {id:'ri12',title:'Initiation Ceremony Preparation',category:'ritual',week:8,required:true,desc:'',done:false},
      ],
    },
    chaplainHub: {
      weeklyFocus:'Faith and Brotherhood', chaplainNotes:'Attendance at devotionals has been strong this semester.', checkIns:[],
      bibleStudies: [
        {id:'bs01',date:past(21),time:'19:00',topic:'Faith and Brotherhood',scripture:'Proverbs 27:17',discussionQuestions:'What does iron sharpening iron look like in our chapter?',attendanceCount:14,notes:'',status:'completed'},
        {id:'bs02',date:past(7),time:'19:00',topic:'Perseverance Through Challenges',scripture:'James 1:2-4',discussionQuestions:'',attendanceCount:11,notes:'',status:'completed'},
      ],
      devotionals: [
        {id:'dv01',date:past(14),time:'19:00',topic:'Faith and Brotherhood',scripture:'Proverbs 27:17',discussionQuestions:'What does iron sharpening iron look like in our chapter?',notes:'Good turnout, strong discussion.',status:'completed'},
        {id:'dv02',date:past(3),time:'19:00',topic:'Perseverance Through Challenges',scripture:'James 1:2-4',discussionQuestions:'',notes:'',status:'completed'},
        {id:'dv03',date:future(4),time:'19:30',topic:'Living with Integrity',scripture:'',discussionQuestions:'',notes:'',status:'planned'},
      ],
      events: [],
    },
    newMemberEducation: {
      // Sessions live on the shared calendar (D.events, type:'pledge') — see the events array above.
      sessions: [],
      requirements: [
        {id:'req01',title:'Attend Orientation Session',due:past(35),desc:''},
        {id:'req03',title:'Complete 5 Community Service Hours',due:future(21),desc:''},
        {id:'req04',title:'Submit Peer Mentor Preference Form',due:future(28),desc:''},
      ],
      progress: {
        m11:{req01:true,req03:true,req04:false},
        m12:{req01:true,req03:false,req04:false},
        m13:{req01:true,req03:false,req04:false},
      },
      mentorGroups: [
        {id:'mg01',name:'Group 1',mentorIds:['m16'],newMemberIds:['m11','m12'],createdBy:'m16',createdAt:Date.now(),updatedAt:Date.now()},
        {id:'mg02',name:'Group 2',mentorIds:['m07','m14'],newMemberIds:['m13'],createdBy:'m16',createdAt:Date.now(),updatedAt:Date.now()},
      ],
      mentorProgramAgenda: [
        {id:'ag01',week:1,topic:'Welcome & Expectations',notes:'Icebreakers; why you joined; set expectations for the semester'},
        {id:'ag02',week:2,topic:'Fraternity History & Founding Values',notes:'Review founding principles and what brotherhood means to you'},
        {id:'ag03',week:3,topic:'Time Management & Academic Success',notes:'Study habits; campus resources; balancing classes and chapter life'},
        {id:'ag04',week:4,topic:'Brotherhood & Building Relationships',notes:'Getting to know brothers outside your pledge class'},
        {id:'ag05',week:5,topic:'Risk Management & Personal Responsibility',notes:'Chapter risk policies; making smart decisions'},
        {id:'ag06',week:6,topic:'Community Service & Philanthropy',notes:'Upcoming service opportunities; why philanthropy matters'},
        {id:'ag07',week:7,topic:'Financial Responsibility',notes:'Dues; budgeting; the chapter\'s finances'},
        {id:'ag08',week:8,topic:'Leadership & Getting Involved',notes:'Committees and ways to get involved beyond new member status'},
        {id:'ag09',week:9,topic:'Alumni Relations',notes:'Staying connected after graduation'},
        {id:'ag10',week:10,topic:'Reflection & Initiation Prep',notes:'Reflect on the semester; what full membership means'},
      ],
    },
    social: {
      planning: {
        e15: {
          status:'completed', eventCategory:'mixer',
          expectedAttendance:40, capacity:60, rsvpDeadline:past(20), actualAttendance:38,
          venue:{name:'Chapter House',address:'',contact:'',phone:'',deposit:0,totalCost:0,confirmed:true,contractStatus:'signed',notes:''},
          transportation:{required:false,provider:'',contact:'',pickupLocation:'',departureTime:'',returnTime:'',vehicleCount:0,capacity:0,cost:0,confirmed:false,notes:''},
          lodging:{required:false,hotel:'',contact:'',roomCount:0,bookingStatus:'not_started',cost:0,notes:''},
          catering:{provider:'Campus Catering Co.',contact:'orders@campuscatering.com',serviceType:'buffet',cost:220,confirmed:true,dietaryNotes:'2 vegetarian trays'},
          entertainment:{provider:'DJ Marcus',contact:'',cost:150,confirmed:true,equipmentNeeds:'',notes:''},
          security:{provider:'',contact:'',staffCount:0,cost:0,confirmed:false,notes:''},
          checklist:[
            {id:'scl01',label:'Confirm catering headcount',assignedTo:'m10',dueDate:past(22),done:true,linkedTaskId:null},
            {id:'scl02',label:'Book DJ',assignedTo:'m10',dueDate:past(25),done:true,linkedTaskId:null},
          ],
          budgetItems:[
            {id:'sbi01',category:'Catering',description:'Buffet dinner',vendor:'Campus Catering Co.',estCost:220,actualCost:220,paymentStatus:'paid',notes:''},
            {id:'sbi02',category:'Entertainment',description:'DJ for the night',vendor:'DJ Marcus',estCost:150,actualCost:150,paymentStatus:'paid',notes:''},
          ],
        },
        e10: {
          status:'rsvp_open', eventCategory:'formal',
          expectedAttendance:80, capacity:100, rsvpDeadline:future(7), actualAttendance:null,
          venue:{name:'Grand Ballroom',address:'400 Main St',contact:'Sasha Lin',phone:'555-0142',deposit:500,totalCost:2400,confirmed:true,contractStatus:'signed',notes:'Deposit paid, balance due week of event.'},
          transportation:{required:true,provider:'Metro Charter Bus',contact:'dispatch@metrocharter.com',pickupLocation:'Chapter House',departureTime:'18:30',returnTime:'23:30',vehicleCount:2,capacity:100,cost:600,confirmed:true,notes:''},
          lodging:{required:false,hotel:'',contact:'',roomCount:0,bookingStatus:'not_started',cost:0,notes:''},
          catering:{provider:'Grand Ballroom Catering',contact:'events@grandballroom.com',serviceType:'plated',cost:3200,confirmed:false,dietaryNotes:'Awaiting final headcount for vegetarian/gluten-free counts'},
          entertainment:{provider:'Live Wire Band',contact:'booking@livewireband.com',cost:1200,confirmed:true,equipmentNeeds:'Stage lighting, 2 mics',notes:''},
          security:{provider:'Campus Event Security',contact:'',staffCount:4,cost:400,confirmed:false,notes:'Quote requested, awaiting confirmation'},
          checklist:[
            {id:'scl03',label:'Venue contract signed',assignedTo:'m10',dueDate:past(10),done:true,linkedTaskId:null},
            {id:'scl04',label:'Send save-the-date',assignedTo:'m10',dueDate:past(5),done:true,linkedTaskId:null},
            {id:'scl05',label:'Finalize catering headcount',assignedTo:'m10',dueDate:future(3),done:false,linkedTaskId:null},
            {id:'scl06',label:'Confirm security staffing',assignedTo:'m10',dueDate:future(5),done:false,linkedTaskId:null},
          ],
          budgetItems:[
            {id:'sbi03',category:'Venue',description:'Ballroom rental',vendor:'Grand Ballroom Events',estCost:2400,actualCost:2400,paymentStatus:'deposit_paid',notes:''},
            {id:'sbi04',category:'Transportation',description:'Charter buses (2)',vendor:'Metro Charter Bus',estCost:600,actualCost:600,paymentStatus:'not_due',notes:''},
            {id:'sbi05',category:'Catering',description:'Plated dinner, 80 guests',vendor:'Grand Ballroom Catering',estCost:3200,actualCost:0,paymentStatus:'deposit_due',notes:''},
            {id:'sbi06',category:'Entertainment',description:'Live band',vendor:'Live Wire Band',estCost:1200,actualCost:1200,paymentStatus:'paid',notes:''},
            {id:'sbi07',category:'Security/Staffing',description:'Event security staff',vendor:'Campus Event Security',estCost:400,actualCost:0,paymentStatus:'not_due',notes:''},
          ],
        },
        e16: {
          status:'planning', eventCategory:'date_party',
          expectedAttendance:50, capacity:null, rsvpDeadline:null, actualAttendance:null,
          venue:{name:'',address:'',contact:'',phone:'',deposit:0,totalCost:0,confirmed:false,contractStatus:'not_started',notes:'Comparing The Lakehouse vs. Overlook Pavilion'},
          transportation:{required:false,provider:'',contact:'',pickupLocation:'',departureTime:'',returnTime:'',vehicleCount:0,capacity:0,cost:0,confirmed:false,notes:''},
          lodging:{required:false,hotel:'',contact:'',roomCount:0,bookingStatus:'not_started',cost:0,notes:''},
          catering:{provider:'',contact:'',serviceType:'',cost:0,confirmed:false,dietaryNotes:''},
          entertainment:{provider:'',contact:'',cost:0,confirmed:false,equipmentNeeds:'',notes:''},
          security:{provider:'',contact:'',staffCount:0,cost:0,confirmed:false,notes:''},
          checklist:[{id:'scl07',label:'Pick venue',assignedTo:'m10',dueDate:future(10),done:false,linkedTaskId:null}],
          budgetItems:[],
        },
      },
      vendors: [
        {id:'sv01',name:'Grand Ballroom Events',type:'venue',contactName:'Sasha Lin',phone:'555-0142',email:'events@grandballroom.com',notes:'Preferred formal venue, books up early.',associatedEventIds:['e10']},
        {id:'sv02',name:'Metro Charter Bus',type:'transportation',contactName:'',phone:'',email:'dispatch@metrocharter.com',notes:'',associatedEventIds:['e10']},
        {id:'sv03',name:'Campus Catering Co.',type:'catering',contactName:'',phone:'',email:'orders@campuscatering.com',notes:'Good for mixers and smaller events.',associatedEventIds:['e15']},
        {id:'sv04',name:'DJ Marcus',type:'entertainment',contactName:'',phone:'',email:'',notes:'',associatedEventIds:['e15']},
      ],
    },
    vendors: [], files: [],
    kcrew: { schedule: kcSchedule },
    chores: { list: choresList, checks: { [kcWeekKey()]: choresChecks } },
    houseLife,
    transitionHub,
    notifs: [], agenda: {items:[],archived:[]},
    healthHistory: [9,8,7,6,5,4,3,2,1,0].map(n=>({date:past(n),score:78+Math.round(Math.sin(n)*4)})),
    announcements: [
      {id:'ann01',title:'Spring Formal tickets on sale now',body:'Grab your Spring Formal ticket before the RSVP deadline. Buses will pick up from the Chapter House, see the Social Events page for the full schedule.',postedBy:'m01',postedByName:'James Mitchell',postedAt:past(2),pinned:true,expiresAt:future(14)},
      {id:'ann02',title:'Dues reminder: balance due this week',body:'A few members still have an outstanding balance for this semester. Please settle up with the Treasurer by Friday to avoid a late fee.',postedBy:'m03',postedByName:'Connor Walsh',postedAt:past(5),pinned:false,expiresAt:future(3)},
      {id:'ann03',title:'New member training session added',body:'New members: an extra education session has been added this semester. Check the New Member Education page for the date and location.',postedBy:'m16',postedByName:'Mason Evans',postedAt:past(9),pinned:false,expiresAt:null},
    ],
    settings,
    // Chapter Achievements — feeds the True Merit Report Assistant's awards_and_achievements
    // section. Fictional milestones only, dated within the demo's current academic year.
    achievements: [
      {id:'ach01',title:'Chapter of Excellence — Regional Award',category:'National Recognition',date:past(45),description:'Recognized by the regional ATO leadership council for chapter operations and accountability.',semester:sem},
      {id:'ach02',title:'100% Formal Recruitment Quota Met',category:'Recruitment Milestone',date:past(60),description:'Chapter met its full new-member quota through formal recruitment for the first time in three years.',semester:sem},
      {id:'ach03',title:'Top Philanthropy Fundraiser on Campus',category:'Philanthropy Milestone',date:past(30),description:'Ranked #1 among Greek organizations on campus for total dollars raised this semester.',semester:sem},
    ],
  };

  // Backfills anything not seeded above (incl. auto-seeding D.bibleStudyCurriculum's full
  // 13-chapter structure via bscEnsureDefaults(), and migrating committees' positions/roster/
  // icon via coEnsureDefaults()) — see js/data.js.
  dDefaults();
}

// ══════════════════════════════════════════════
// DEMO BOOT — replaces the real login/onAuthStateChanged flow entirely
// ══════════════════════════════════════════════
async function init(){
  loadDemoData();

  const authLoading = document.getElementById('auth-loading');
  if(authLoading){ authLoading.classList.add('hidden'); setTimeout(()=>authLoading.remove(),400); }

  CURRENT_CHAPTER = { enabledModules: ALL_PAGES, positions: DEFAULT_POSITIONS };
  CURRENT_USER = {
    uid: 'demo_user', email: 'president@ato-demo.example',
    name: 'James Mitchell', title: 'President', secondaryTitle: null,
    role: 'exec', superAdmin: false,
    chapterId: 'demo_epsilon_chapter', chapterName: D.settings.chapterName, university: D.settings.university,
    mid: 'm01', lastLogin: 'First session',
  };

  const gate = document.getElementById('login-gate');
  if(gate) gate.style.display = 'none';
  const appNav = document.getElementById('app-nav');
  const appMain = document.getElementById('app-main');
  if(appNav) appNav.style.display = '';
  if(appMain) appMain.style.display = '';

  document.getElementById('u-av').textContent = 'JM';
  document.getElementById('u-name').textContent = CURRENT_USER.name;
  document.getElementById('u-role').textContent = CURRENT_USER.title;
  document.getElementById('tb-av').textContent = 'JM';

  const now = new Date();
  const tbDate = document.getElementById('tb-date');
  if(tbDate) tbDate.textContent = now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) + ' · ' + getSemester();
  const sbSem = document.getElementById('sb-sem');
  if(sbSem) sbSem.textContent = CURRENT_USER.university + ' · ' + getSemester();
  const sbChname = document.getElementById('sb-chname');
  if(sbChname) sbChname.textContent = CURRENT_USER.chapterName;
  document.title = CURRENT_USER.chapterName + ': ATO Executive System (Demo)';
  const ned = document.getElementById('ne-d');
  if(ned) ned.value = localDateStr(now);
  const mnd = document.getElementById('mn-d');
  if(mnd) mnd.value = localDateStr(now);

  rbacApplySidebar();
  resetInactivityTimer();

  const mbnDash = document.getElementById('mbn-dashboard');
  if(mbnDash) mbnDash.classList.add('active');

  renderDash();
  updateBadges();
  demoCollapseDashboardExtras();
}

// ══════════════════════════════════════════════
// DEMO DASHBOARD DENSITY — a cold prospect's very first frame after auto-login is the full
// Dashboard: hero + quickbar + KPI strip + 4 left cards + 5 right cards, all above the fold on a
// laptop. That's the right density for daily use, but backwards for a five-minute self-guided
// demo, which should sell the value proposition before proving feature-completeness. This hides
// only the DOM already in index.html (dashboard.js/renderDash() still populate the hidden cards'
// content normally; they're just not shown until requested) — no page/route/component change.
// ══════════════════════════════════════════════
function demoCollapseDashboardExtras(){
  const officersCard = document.getElementById('d-officers-card');
  const soberCard = document.getElementById('d-sober') && document.getElementById('d-sober').closest('.d2-card');
  const notesCard = document.getElementById('d-notes') && document.getElementById('d-notes').closest('.d2-card');
  const extras = [officersCard, soberCard, notesCard].filter(Boolean);
  if(!extras.length) return;
  extras.forEach(card => { card.style.display = 'none'; });

  const body = document.querySelector('#page-dashboard .d2-body');
  if(!body || document.getElementById('d-show-more-toggle')) return;
  const toggle = document.createElement('button');
  toggle.id = 'd-show-more-toggle';
  toggle.className = 'btn';
  toggle.style.cssText = 'margin-top:14px;width:100%;justify-content:center';
  toggle.innerHTML = `<i class="ti ti-chevron-down"></i>Show full dashboard (Officer KPIs, Social Monitors, Recent Notes)`;
  toggle.onclick = () => {
    extras.forEach(card => { card.style.display = ''; });
    toggle.remove();
  };
  body.insertAdjacentElement('afterend', toggle);
}

// Demo-only replacement for the real seRenderUsers() (js/auth.js) — that one queries Firestore's
// `users` collection for the chapter's real accounts/pending approvals, which don't exist here.
// This shows the same officer roster shape read-only from the seeded D.members instead.
function seRenderUsers(){
  const el = document.getElementById('se-users');
  if(!el) return;
  const officers = D.members.filter(m => m.role && m.role !== 'Member');
  el.innerHTML = `<div style="font-size:11.5px;color:var(--mt);padding:6px 0 10px">Signed in as <strong>${esc(CURRENT_USER.email)}</strong> · <strong>${esc(CURRENT_USER.title)}</strong>. This demo has one fixed account; use the role switcher above to explore other positions.</div>`
    + officers.map(m => `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bdr);gap:8px">
        <span style="font-size:12px;font-weight:500;color:var(--tx)">${esc(m.name)}</span>
        <span style="font-size:11px;color:var(--mt)">${esc(m.role)}</span>
      </div>`).join('');
}

// ══════════════════════════════════════════════
// DEMO ROLE SWITCHER — reassigns CURRENT_USER against the real DEFAULT_POSITIONS titles so
// sidebar/edit-control access is driven by the exact same getRoleAccess()/canEditPage() logic
// production uses, not a simplified stand-in.
// ══════════════════════════════════════════════
function switchDemoRole(role){
  if(!CURRENT_USER || !role) return;
  const isViewer = role === 'General Member';
  CURRENT_USER.role = isViewer ? 'viewer' : 'exec';
  CURRENT_USER.title = isViewer ? 'General Member' : role;

  const person = isViewer ? null : D.members.find(m => m.role === role);
  const av = person ? person.initials : (isViewer ? 'GM' : role.slice(0,2).toUpperCase());
  const name = person ? person.name : (isViewer ? 'Guest Member' : role);
  document.getElementById('u-av').textContent = av;
  document.getElementById('u-name').textContent = name;
  document.getElementById('u-role').textContent = isViewer ? 'General Member' : role;
  document.getElementById('tb-av').textContent = av;

  rbacApplySidebar();
  const label = document.getElementById('demo-role-label');
  if(label) label.textContent = isViewer ? 'General Member' : role;
  const sel = document.getElementById('demo-role-switcher');
  if(sel) sel.selectedIndex = 0;
  rbacNav(isViewer ? 'calendar' : 'dashboard', null);
  toast(`Now viewing as ${isViewer ? 'a General Member' : role}, sidebar and edit controls reflect this role`, 'info', 3500);
}

// ══════════════════════════════════════════════
// DEMO BANNER COLLAPSE — "×" used to call display:none on the whole #demo-banner, which also
// removed the role switcher (the demo's main selling mechanic) with no way back short of a full
// reload. This instead hides only the badge/explanatory text and keeps the switcher + a re-expand
// control permanently on screen.
// ══════════════════════════════════════════════
function toggleDemoBanner(){
  const badge = document.getElementById('demo-banner-badge');
  const text = document.getElementById('demo-banner-text');
  const btn = document.getElementById('demo-banner-toggle');
  if(!badge || !text || !btn) return;
  const collapsed = badge.style.display === 'none';
  badge.style.display = collapsed ? '' : 'none';
  text.style.display = collapsed ? '' : 'none';
  btn.textContent = collapsed ? '×' : '▾';
  btn.title = collapsed ? 'Dismiss' : 'Show demo info';
}

// ══════════════════════════════════════════════
// DEMO TRUE MERIT EXPORT — overrides js/truemerit.js's tmGenerateAndDownload() (loaded above this
// file, so this redefinition wins) so a demo download never reflects the seeded persona's actual
// dataset. Building the real export from D would either look sparse (this demo's roster is
// deliberately small — see loadDemoData()) or, if D were padded up just to make the export look
// good, would make every other page in the demo report numbers nobody entered. A canned, fully-
// shaped showcase report keeps every other page honest while still letting a prospect open a
// full, realistic annual export and see exactly what the real feature produces — including the
// same structural "partial"/"unavailable" data_completeness sections the real export always
// reports (e.g. no beginning-of-year headcount, no PR module) rather than a rosier shape that
// oversells what the live product can actually track.
// ══════════════════════════════════════════════
function tmBuildDemoShowcaseReport(academicYear) {
  const range = tmAcademicYearRange(academicYear);
  if (!range) throw new Error('Invalid academic year: ' + academicYear);
  const [fallLabel, springLabel] = range.semesters;
  const fy = fallLabel.split(' ')[1], sy = springLabel.split(' ')[1];
  const chapterName = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.chapterName) || 'Epsilon Chapter';
  const university = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.university) || 'Overlook State University';

  const chapter_overview = {
    chapter_name: chapterName, university, academic_year: academicYear, included_semesters: range.semesters,
    active_member_count: 84, beginning_of_year_membership: null, ending_membership: 84,
    new_members_count: 24, graduates_count: null,
    officer_positions: ['Chaplain', 'Historian', 'New Member Educator', 'President', 'Recruitment Chair', 'Risk Manager', 'Secretary', 'Social Chair', 'Treasurer', 'Vice President'],
    committees: [
      { name: 'Recruitment Committee', chair_position: true, member_count: 9 },
      { name: 'Philanthropy Committee', chair_position: true, member_count: 11 },
      { name: 'Social Committee', chair_position: true, member_count: 7 },
      { name: 'Risk Management Committee', chair_position: true, member_count: 6 },
      { name: 'Alumni Relations Committee', chair_position: false, member_count: 5 },
    ],
  };

  const membership = {
    total_members: 84, live_in_count: 46,
    by_class_year: { Freshman: 19, Sophomore: 21, Junior: 23, Senior: 21 },
    by_status: { Active: 79, 'New Member': 5 },
    new_members_count: 24,
    new_members_by_semester: { [fallLabel]: 14, [springLabel]: 10 },
  };

  const leadership_and_goals = {
    goals: [
      { position: 'President', goal: 'Raise overall chapter GPA above the all-campus fraternity average', semester: fallLabel, metric: 'GPA', target: 3.2, actual: 3.31, completion_percentage: 100, status: 'completed' },
      { position: 'Recruitment Chair', goal: 'Extend 30 bids across both semesters', semester: springLabel, metric: 'bids', target: 30, actual: 27, completion_percentage: 90, status: 'in_progress' },
      { position: 'Philanthropy Chair', goal: 'Raise $15,000 for St. Jude', semester: springLabel, metric: 'dollars', target: 15000, actual: 16250, completion_percentage: 100, status: 'completed' },
      { position: 'Treasurer', goal: 'Achieve a 95% dues collection rate', semester: fallLabel, metric: 'percent', target: 95, actual: 93.1, completion_percentage: 98, status: 'in_progress' },
      { position: 'Risk Manager', goal: 'Zero risk management violations for the year', semester: fallLabel, metric: null, target: null, actual: null, completion_percentage: null, status: null },
      { position: 'Vice President', goal: 'Maintain 90%+ chapter meeting attendance', semester: springLabel, metric: 'percent', target: 90, actual: 91.4, completion_percentage: 100, status: 'completed' },
    ],
    tasks_summary: { total: 132, completed: 118, overdue: 6, completion_rate: 89.4 },
    tasks_by_position: [
      { position: 'President', tasks_total: 22, tasks_completed: 20, tasks_overdue: 1, completion_rate: 90.9 },
      { position: 'Treasurer', tasks_total: 18, tasks_completed: 17, tasks_overdue: 0, completion_rate: 94.4 },
      { position: 'Recruitment Chair', tasks_total: 26, tasks_completed: 22, tasks_overdue: 2, completion_rate: 84.6 },
      { position: 'Philanthropy Chair', tasks_total: 15, tasks_completed: 14, tasks_overdue: 0, completion_rate: 93.3 },
      { position: 'Social Chair', tasks_total: 20, tasks_completed: 17, tasks_overdue: 1, completion_rate: 85 },
      { position: 'New Member Educator', tasks_total: 16, tasks_completed: 15, tasks_overdue: 1, completion_rate: 93.8 },
      { position: 'Risk Manager', tasks_total: 15, tasks_completed: 13, tasks_overdue: 1, completion_rate: 86.7 },
    ],
    committees: [
      { name: 'Recruitment Committee', description: 'Plans and executes fall/spring recruitment', has_chair: true, member_count: 9, program_weeks: 6 },
      { name: 'Philanthropy Committee', description: 'Coordinates fundraising events and partner charities', has_chair: true, member_count: 11, program_weeks: 4 },
      { name: 'Social Committee', description: 'Plans brotherhood and social events', has_chair: true, member_count: 7, program_weeks: 0 },
      { name: 'Risk Management Committee', description: 'Oversees event safety and compliance', has_chair: true, member_count: 6, program_weeks: 0 },
      { name: 'Alumni Relations Committee', description: 'Maintains alumni contact and engagement', has_chair: false, member_count: 5, program_weeks: 0 },
    ],
  };

  const attendance = {
    chapter_attendance_rate: 91.4, total_tracked_events: 34, mandatory_event_count: 21,
    by_semester: { [fallLabel]: { attendance_rate: 92.6, mandatory_events: 11 }, [springLabel]: { attendance_rate: 90.1, mandatory_events: 10 } },
    event_summaries: [
      { title: 'Fall Chapter Meeting — Week 1', date: `${fy}-09-04`, type: 'chapter', semester: fallLabel, present_count: 78, tracked_count: 84 },
      { title: 'Founders Day Formal', date: `${fy}-11-08`, type: 'brotherhood', semester: fallLabel, present_count: 80, tracked_count: 84 },
      { title: 'Spring Chapter Meeting — Week 1', date: `${sy}-01-14`, type: 'chapter', semester: springLabel, present_count: 76, tracked_count: 84 },
      { title: 'Founders Day 5K', date: `${sy}-03-02`, type: 'philanthropy', semester: springLabel, present_count: 71, tracked_count: 84 },
    ],
  };

  const recruitment = {
    total_prospects: 40, pipeline_by_stage: { Interested: 6, 'Bid Extended': 3, Accepted: 27, 'Not Continuing': 4 },
    bids_extended: 30, bids_accepted: 27, bids_declined: null, new_members_from_recruitment: 27,
    bid_acceptance_rate: 90, conversion_rate: 67.5,
    goals_by_semester: { [fallLabel]: { target: 14, label: 'Fall bid target', actual: 14, status: 'completed' }, [springLabel]: { target: 16, label: 'Spring bid target', actual: 13, status: 'in_progress' } },
    recruitment_events: [
      { title: 'Fall Rush Week Kickoff', date: `${fy}-09-02`, semester: null, location: 'Chapter House', mandatory: true },
      { title: 'Bid Day', date: `${fy}-09-20`, semester: null, location: 'Chapter House', mandatory: true },
      { title: 'Spring Open House', date: `${sy}-01-22`, semester: null, location: 'Chapter House', mandatory: false },
    ],
  };

  const member_education = {
    new_member_class_size: 24, requirements_total: 8,
    requirement_completion: [
      { title: 'National History Exam', due: `${fy}-10-15`, completion_rate: 100 },
      { title: 'Risk Management Certification', due: `${fy}-10-01`, completion_rate: 100 },
      { title: 'Big Brother Assignment', due: `${fy}-09-30`, completion_rate: 95.8 },
      { title: 'Community Service (10 hrs)', due: `${sy}-04-01`, completion_rate: 87.5 },
    ],
    programming_events: [
      { title: 'New Member Orientation', date: `${fy}-09-10`, location: 'Chapter House' },
      { title: 'Ritual Education Session', date: `${fy}-10-22`, location: 'Chapter House' },
    ],
  };

  const brotherhood_and_programming = {
    events: [
      { title: 'Fall Retreat', date: `${fy}-09-27`, type: 'brotherhood', location: 'Camp Wildwood', attendance_count: 71 },
      { title: 'Big/Little Reveal', date: `${fy}-10-18`, type: 'brotherhood', location: 'Chapter House', attendance_count: 80 },
      { title: 'Spring Brotherhood Retreat', date: `${sy}-03-14`, type: 'brotherhood', location: 'Lake Overlook', attendance_count: 68 },
      { title: 'Weekly Bible Study', date: `${fy}-09-11`, type: 'faith', location: 'Chapter House', attendance_count: 15 },
    ],
    faith_programming_counts: { bible_studies: 13, devotionals: 26, chaplain_events: 4 },
  };

  const academics = {
    by_semester: { [fallLabel]: { chapter_gpa: '3.29', cumulative_chapter_gpa: '3.31', members_reporting: 84 }, [springLabel]: { chapter_gpa: '3.34', cumulative_chapter_gpa: '3.32', members_reporting: 82 } },
    gpa_trend: 0.05, semesters_with_data: [fallLabel, springLabel],
  };

  const philanthropy = {
    total_raised: 16250, raised_by_semester: { [fallLabel]: 9400, [springLabel]: 6850 }, event_count: 3,
    organizations: ["St. Jude Children's Research Hospital", 'ALS Association'],
    goal: { target: 15000, label: 'Annual St. Jude fundraising goal' },
    events: [
      { title: 'Casino Night for St. Jude', date: `${fy}-11-01`, attendance_count: 60, amount_raised: 5200 },
      { title: 'ATO 5K Fun Run', date: `${sy}-03-02`, attendance_count: 110, amount_raised: 4100 },
      { title: 'Golf Tournament', date: `${sy}-04-12`, attendance_count: 75, amount_raised: 2750 },
    ],
  };

  const community_service = {
    total_hours: 612, hours_by_semester: { [fallLabel]: 340, [springLabel]: 272 }, event_count: 4,
    participant_count: 58, avg_hours_per_participant: 10.55,
    partner_organizations: ['Overlook Food Bank', 'Habitat for Humanity', 'Boys & Girls Club'],
    events: [
      { title: 'Habitat for Humanity Build Day', date: `${fy}-10-05`, hours_logged: 96 },
      { title: 'Food Bank Sorting Shift', date: `${fy}-11-16`, hours_logged: 54 },
      { title: 'Boys & Girls Club Tutoring', date: `${sy}-02-20`, hours_logged: 88 },
      { title: 'Campus Cleanup Day', date: `${sy}-04-05`, hours_logged: 62 },
    ],
  };

  const alumni_relations = {
    total_alumni_engaged: 46,
    events: [
      { title: 'Homecoming Alumni Tailgate', date: `${fy}-10-11`, type: 'alumni', location: 'Chapter House' },
      { title: 'Founders Day Alumni Dinner', date: `${fy}-11-08`, type: 'alumni', location: 'Overlook Country Club' },
    ],
    outreach_touches: 38, outreach_by_method: { Email: 18, LinkedIn: 11, Phone: 9 },
  };

  const public_relations = { tracked: false, note: 'ATO Executive System does not currently have a dedicated Public Relations/Communications module. This section cannot be populated automatically.' };

  const finance = {
    dues_collection_rate: 93.1, total_dues_billed: 92400, total_dues_collected: 86014, total_outstanding: 6386,
    dues_status_breakdown: { Paid: 66, Partial: 12, Unpaid: 6 },
    by_semester: { [fallLabel]: { total_due: 46200, total_paid: 43500, collection_rate: 94.2 }, [springLabel]: { total_due: 46200, total_paid: 42514, collection_rate: 92 } },
    fines_total_count: 14, fines_total_amount: 1050,
    expenses_by_category: { Philanthropy: 4200, Social: 8600, 'Chapter Operations': 11300, Recruitment: 3100, 'Risk Management': 1800 },
    total_expenses: 29000, payment_plan_count: 5,
    approved_budget: { [fallLabel]: 48000, [springLabel]: 46500 },
  };

  const judicial_and_accountability = {
    cases_total: 5, cases_resolved: 4, cases_open: 1, resolution_rate: 80, average_resolution_days: null,
    case_categories: { 'attendance-violation': 3, 'risk-management': 1, 'academic-probation': 1 },
    semester_breakdown: { [fallLabel]: 3, [springLabel]: 2 },
    sanction_categories: {}, accountability_programs: [],
  };

  const chapter_events = [
    { id: 'demo-e1', title: 'Fall Chapter Meeting — Week 1', type: 'chapter', date: `${fy}-09-04`, semester: fallLabel, location: 'Chapter House', committee_id: null, mandatory: true, attendance_count: 78, amount_raised: null, service_hours: null },
    { id: 'demo-e2', title: 'Casino Night for St. Jude', type: 'philanthropy', date: `${fy}-11-01`, semester: fallLabel, location: 'Chapter House', committee_id: null, mandatory: false, attendance_count: 60, amount_raised: 5200, service_hours: null },
    { id: 'demo-e3', title: 'Habitat for Humanity Build Day', type: 'service', date: `${fy}-10-05`, semester: fallLabel, location: 'Habitat for Humanity Site', committee_id: null, mandatory: false, attendance_count: 24, amount_raised: null, service_hours: 96 },
    { id: 'demo-e4', title: 'Spring Chapter Meeting — Week 1', type: 'chapter', date: `${sy}-01-14`, semester: springLabel, location: 'Chapter House', committee_id: null, mandatory: true, attendance_count: 76, amount_raised: null, service_hours: null },
    { id: 'demo-e5', title: 'ATO 5K Fun Run', type: 'philanthropy', date: `${sy}-03-02`, semester: springLabel, location: 'Overlook State Quad', committee_id: null, mandatory: false, attendance_count: 110, amount_raised: 4100, service_hours: null },
  ];

  const awards_and_achievements = [
    { title: 'ATO Nationals True Merit Award of Excellence', category: 'National Recognition', date: `${sy}-05-01`, semester: springLabel, description: 'Recognized for outstanding chapter operations, philanthropy, and academic performance.' },
    { title: 'Top GPA Among Campus Fraternities', category: 'Academic', date: `${sy}-05-10`, semester: springLabel, description: 'Ranked #1 chapter GPA among all IFC fraternities at Overlook State.' },
  ];

  const strategic_initiatives = [
    { title: 'Raise overall chapter GPA above the all-campus fraternity average', owner: 'President', semester: fallLabel, goal: 'Raise overall chapter GPA above the all-campus fraternity average', result: 'Completed', related_events: [] },
    { title: 'Raise $15,000 for St. Jude', owner: 'Philanthropy Chair', semester: springLabel, goal: 'Raise $15,000 for St. Jude', result: 'Completed', related_events: [] },
    { title: 'Fall Executive Retreat Planning', owner: null, semester: fallLabel, goal: null, result: null, related_events: [] },
  ];

  const executive_notes = [
    { title: 'Fall Executive Retreat', type: 'retreat', date: `${fy}-08-20`, action_item_count: 6 },
    { title: 'Spring Exec Check-in', type: 'exec', date: `${sy}-02-03`, action_item_count: 4 },
  ];

  // Mirrors js/truemerit.js's tmBuildDataCompleteness() exactly — including the same structural
  // gaps the real export always reports (no beginning-of-year headcount, no PR module, no
  // declined-prospect tracking, no case resolution date) — so the demo's "Data Completeness"
  // section is not rosier than what a real chapter would ever actually see.
  const data_completeness = {
    overall_status: 'partial',
    sections: {
      chapter_overview: { status: 'partial', record_count: 1, missing: ['Beginning-of-year membership count (not tracked — no historical roster snapshot)', 'Graduate count (member status has no "Graduated"/"Alumni" state; departed members are removed from the roster)'] },
      membership: { status: 'complete', record_count: 84, missing: [] },
      leadership_and_goals: { status: 'complete', record_count: 138, missing: [] },
      attendance: { status: 'complete', record_count: 34, missing: [] },
      recruitment: { status: 'partial', record_count: 40, missing: ['Declined/not-interested prospects are not tracked as a distinct pipeline stage'] },
      member_education: { status: 'complete', record_count: 24, missing: [] },
      brotherhood_and_programming: { status: 'complete', record_count: 4, missing: [] },
      academics: { status: 'complete', record_count: 2, missing: [] },
      philanthropy: { status: 'complete', record_count: 3, missing: [] },
      community_service: { status: 'complete', record_count: 4, missing: [] },
      alumni_relations: { status: 'complete', record_count: 40, missing: [] },
      public_relations: { status: 'unavailable', record_count: 0, missing: ['No Public Relations/Communications module exists in ATO Executive System yet'] },
      finance: { status: 'complete', record_count: 2, missing: [] },
      judicial_and_accountability: { status: 'partial', record_count: 5, missing: ['Average resolution time is not tracked (no resolution date stored on a case, only a hearing date)'] },
      chapter_events: { status: 'complete', record_count: 5, missing: [] },
      awards_and_achievements: { status: 'complete', record_count: 2, missing: [] },
      strategic_initiatives: { status: 'complete', record_count: 3, missing: [] },
    },
  };

  return {
    schema_version: TM_SCHEMA_VERSION,
    report_metadata: {
      chapter_id: 'demo_epsilon_chapter', chapter_name: chapterName, university,
      academic_year: academicYear, included_semesters: range.semesters,
      generated_at: new Date().toISOString(),
      generated_by_role: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.title) || 'President',
      system: 'ATO Executive System',
    },
    chapter_overview, membership, leadership_and_goals, attendance, recruitment, member_education,
    brotherhood_and_programming, academics, philanthropy, community_service, alumni_relations,
    public_relations, finance, judicial_and_accountability, chapter_events, awards_and_achievements,
    strategic_initiatives, executive_notes, data_completeness,
  };
}

// Redefines js/truemerit.js's tmGenerateAndDownload() — this declaration runs after that file's
// (see script order in index.html), so it wins and every demo download uses the canned showcase
// report above instead of building from the seeded persona's real (small) D object.
async function tmGenerateAndDownload() {
  if (!tmCanGenerateReport()) { toast('Only the President or Vice President can generate a True Merit data export.', 'error'); return; }
  const sel = document.getElementById('tm-ay');
  const academicYear = sel ? sel.value : tmCurrentAcademicYear();
  const btn = document.getElementById('tm-generate-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    const report = tmBuildDemoShowcaseReport(academicYear);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = tmFilename(report.report_metadata.chapter_name, academicYear); a.click();
    URL.revokeObjectURL(url);
    closeM(null, document.getElementById('m-truemerit'));
    toast('Sample annual export generated — this demo always downloads a fully-populated showcase file rather than the seeded persona\'s own (deliberately small) data.', 'info', 7000);
  } catch (e) {
    console.error('Demo True Merit export failed:', e);
    toast('Could not generate the sample export. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Generate & Download JSON'; }
  }
}

init();
