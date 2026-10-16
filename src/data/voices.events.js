// Event voice lines for Hyderabad Tycoon: what the "film heroes" say when something happens in a match,
// plus the soundboard (emote) lines the player can tap.
//
// ALL LINES ARE ORIGINAL, affectionate fan-made flavour written in each actor's on-screen *style*.
// None of them is real film dialogue, a catchphrase sentence or a song lyric, and none is meant to
// suggest that a real person actually said it.
//
// Line = { id, actor, te, tn, en, mood }
//   id    `<actor code>_<trigger>_<n>`, globally unique. A recorded clip for the line lives at
//         public/voices/<actor>/<id>.mp3 (see public/voices/README.md). NEVER renumber an id once a
//         clip has been recorded for it; add new lines with a new, higher number instead.
//   te    Telugu script (shown as the big subtitle and read by the phone's Telugu text-to-speech)
//   tn    the same line in English letters ("Tenglish")
//   en    short English gist
//   mood  mass | comedy | warm | cool
//
// Actor codes: bk balakrishna, ch chiranjeevi, pk pawankalyan, mb maheshbabu, aa alluarjun,
//              pr prabhas, nt ntr, rc ramcharan, ng nagarjuna, vk venkatesh, rt raviteja, bm brahmanandam.

const CODES = {
  bk: 'balakrishna',
  ch: 'chiranjeevi',
  pk: 'pawankalyan',
  mb: 'maheshbabu',
  aa: 'alluarjun',
  pr: 'prabhas',
  nt: 'ntr',
  rc: 'ramcharan',
  ng: 'nagarjuna',
  vk: 'venkatesh',
  rt: 'raviteja',
  bm: 'brahmanandam',
};

/** rows: [id, te, tn, en, mood][]  ->  Line[] (actor is taken from the id's code prefix). */
const lines = (rows) =>
  rows.map(([id, te, tn, en, mood]) => ({ id, actor: CODES[id.split('_')[0]], te, tn, en, mood }));

export default {
  // ------------------------------------------------------------------ match flow
  game_start: lines([
    ['bk_game_start_1', 'ఆట మొదలైంది! ఈ సిటీకి మన గర్జన వినిపించాలి!', 'Aata modalaindi! Ee city ki mana garjana vinipinchaali!', 'The game is on! The city must hear our roar!', 'mass'],
    ['ch_game_start_2', 'స్టైల్‌గా మొదలుపెడదాం, ఈ ఆట మనదే!', 'Style ga modalupedadaam, ee aata manade!', "Let's start in style, this game is ours!", 'mass'],
    ['mb_game_start_3', 'ప్లాన్ రెడీ. ఇక ఆట మొదలుపెడదాం.', 'Plan ready. Ika aata modalupedadaam.', "The plan is ready. Let's begin.", 'cool'],
    ['vk_game_start_4', 'అందరికీ నమస్కారం! హాయిగా ఆడుకుందాం, గెలుపు ఎవరిదైనా సరే.', 'Andariki namaskaaram! Haayiga aadukundaam, gelupu evaridaina sare.', "Hello everyone! Let's play happily, whoever wins.", 'warm'],
    ['rt_game_start_5', 'రెడీనా? సీట్‌బెల్ట్ పెట్టుకోండి, ఇది స్పీడ్ గేమ్!', 'Ready naa? Seatbelt pettukondi, idi speed game!', 'Ready? Buckle up, this is a fast game!', 'mass'],
    ['pr_game_start_6', 'అందరికీ స్వాగతం. మంచి ఆట ఆడుదాం, సరేనా?', 'Andariki swaagatham. Manchi aata aadudaam, sarenaa?', "Welcome all. Let's play a good game, okay?", 'warm'],
  ]),

  roll: lines([
    ['rt_roll_1', 'డైస్ వేద్దాం, పరుగు మొదలు!', 'Dice veddaam, parugu modalu!', "Let's roll, the race begins!", 'mass'],
    ['aa_roll_2', 'డైస్ మన స్టైల్‌లో పడతాయి, చూడండి.', 'Dice mana style lo padathayi, choodandi.', 'The dice will land our way, watch.', 'cool'],
    ['pr_roll_3', 'నెమ్మదిగా వేద్దాం, అదృష్టం మన చేతిలోనే ఉంది.', 'Nemmadiga veddaam, adrushtam mana chethilone undi.', 'Easy does it, luck is in our hands.', 'warm'],
    ['bm_roll_4', 'అయ్యో, ఈ డైస్ నా మాట వినవు కదా!', 'Ayyo, ee dice naa maata vinavu kadaa!', 'Oh no, these dice never listen to me!', 'comedy'],
    ['ng_roll_5', 'కూల్‌గా డైస్ వేద్దాం, నంబర్ అదే వస్తుంది.', 'Cool ga dice veddaam, number ade vasthundi.', 'Roll it cool, the number will come.', 'cool'],
    ['bk_roll_6', 'పాచికలు పడాలి, పిడుగులా పడాలి!', 'Paachikalu padaali, pidugulaa padaali!', 'Let the dice fall like a thunderbolt!', 'mass'],
  ]),

  doubles: lines([
    ['bm_doubles_1', 'డబుల్స్! మళ్ళీ వేయాలా? నా గుండె ఆగిపోతోంది!', 'Doubles! Malli veyaalaa? Naa gunde aagipothondi!', 'Doubles! Roll again? My heart is stopping!', 'comedy'],
    ['rc_doubles_2', 'డబుల్స్! మెగా ఎనర్జీ ఇప్పుడే మొదలైంది!', 'Doubles! Mega energy ippude modalaindi!', 'Doubles! The mega energy has just begun!', 'mass'],
    ['rt_doubles_3', 'డబుల్స్ వచ్చాయి, ఇంకో రౌండ్ ఫ్రీ!', 'Doubles vachaayi, inko round free!', 'Doubles! Another round, free!', 'mass'],
    ['nt_doubles_4', 'డబుల్స్! ఇంకో రోల్, ఇంకా వేగంగా!', 'Doubles! Inko roll, inka vegamga!', 'Doubles! One more roll, even faster!', 'mass'],
    ['vk_doubles_5', 'డబుల్స్ వచ్చాయి, ఇంట్లో పండగే!', 'Doubles vachaayi, intlo pandage!', "Doubles! It's a festival at home!", 'warm'],
  ]),

  pass_start: lines([
    ['ch_pass_start_1', 'జీతం పడింది! ఇక స్టైల్‌గా ఇన్వెస్ట్ చేద్దాం.', 'Jeetham padindi! Ika style ga invest cheddaam.', 'Salary credited! Now invest in style.', 'mass'],
    ['vk_pass_start_2', 'జీతం వచ్చింది, ఇంట్లో అందరికీ సంతోషం!', 'Jeetham vachindi, intlo andariki santhosham!', "Salary's in, everyone at home is happy!", 'warm'],
    ['pk_pass_start_3', 'జీతం వచ్చింది. మాటలు తక్కువ, పని ఎక్కువ.', 'Jeetham vachindi. Maatalu takkuva, pani ekkuva.', "Salary's in. Fewer words, more work.", 'cool'],
    ['bm_pass_start_4', 'ఆహా, జీతం! ఇంటికెళ్తే ఇంకా ఎక్కువ అడుగుతారు!', 'Aaha, jeetham! Intikelthe inka ekkuva adugutaaru!', "Wow, salary! At home they'll ask for even more!", 'comedy'],
    ['aa_pass_start_5', 'స్టార్ట్ దాటాను, క్యాష్ జేబులోకి!', 'Start daatanu, cash jebuloki!', 'Crossed START, cash into the pocket!', 'cool'],
    ['pr_pass_start_6', 'జీతం వచ్చింది. ముందు అందరికీ బిర్యానీ పెడతా!', 'Jeetham vachindi. Mundu andariki biryani pedathaa!', "Salary's in. Biryani for everyone first!", 'warm'],
  ]),

  // ------------------------------------------------------------------ property
  buy: lines([
    ['bk_buy_1', 'ఈ స్థలం ఇక నా సొంతం! ఎవరు వచ్చినా అద్దె కట్టాల్సిందే!', 'Ee sthalam ika naa sontham! Evaru vachchinaa addhe kattaalsinde!', 'This plot is mine now! Whoever comes must pay rent!', 'mass'],
    ['pr_buy_2', 'ప్లాట్ కొన్నాను. అందరూ రండి, ఆతిథ్యం మనదే.', 'Plot konnaanu. Andaruu randi, aatithyam manade.', "Bought the plot. Everyone come, hospitality's on me.", 'warm'],
    ['mb_buy_3', 'మంచి డీల్. ఇది లాభం ఇస్తుంది.', 'Manchi deal. Idi laabham istundi.', 'A good deal. This one will pay off.', 'cool'],
    ['aa_buy_4', 'కొనేశా! ఇప్పుడు ఈ ప్రాపర్టీకి స్టైల్ వచ్చింది.', 'Konesha! Ippudu ee property ki style vachindi.', 'Bought it! Now this property has style.', 'cool'],
    ['ng_buy_5', 'కింగ్ సైజ్ డెసిషన్. ఈ ప్రాపర్టీ నాదే.', 'King size decision. Ee property naade.', 'A king-size decision. This property is mine.', 'cool'],
    ['vk_buy_6', 'కొత్త ఇల్లు కొన్నంత సంతోషం! ఇంట్లో అందరికీ చెప్పాలి!', 'Kotta illu konnantha santhosham! Intlo andariki cheppaali!', 'Feels like buying a new home! Must tell everyone!', 'warm'],
    ['rc_buy_7', 'డీల్ క్లోజ్! ఈ ఏరియా ఇప్పుడు మన కంట్రోల్‌లో.', 'Deal close! Ee area ippudu mana control lo.', 'Deal closed! This area is in our control now.', 'mass'],
  ]),

  buy_premium: lines([
    ['bk_buy_premium_1', 'ఇది బంగారు స్థలం! సింహంలా నిలబడి కాపాడుకుంటా!', 'Idi bangaaru sthalam! Simhamlaa nilabadi kaapadukuntaa!', "A golden plot! I'll guard it like a lion!", 'mass'],
    ['ch_buy_premium_2', 'ప్రీమియం ప్రాపర్టీ, మెగా స్టైల్ ఎంట్రీ!', 'Premium property, mega style entry!', 'Premium property, a mega-style entry!', 'mass'],
    ['mb_buy_premium_3', 'టాప్ లొకేషన్. ఇది నా పోర్ట్‌ఫోలియోకి కిరీటం.', 'Top location. Idi naa portfolio ki kireetam.', 'Top location. A crown for my portfolio.', 'cool'],
    ['ng_buy_premium_4', 'ఇది రాజుల ఏరియా, కింగ్‌కి తగిన చోటు.', 'Idi raajula area, King ki thagina chotu.', 'This is the royal area, a fitting place for the King.', 'cool'],
    ['rt_buy_premium_5', 'వావ్, ధర చూస్తే తల తిరిగింది, కానీ కొనేశా!', 'Wow, dhara choosthe thala thirigindi, kaani konesha!', 'Wow, the price made my head spin, but I bought it!', 'mass'],
    ['nt_buy_premium_6', 'ఇంత విలువైన స్థలం, ఇక నా కోట!', 'Intha viluvaina sthalam, ika naa kota!', 'Such a precious plot, now my fortress!', 'mass'],
    ['bm_buy_premium_7', 'ఇంత రేటా? డబ్బులు ఇచ్చేటప్పుడు కళ్ళు మూసుకున్నా!', 'Intha rate aa? Dabbulu ichchetappudu kallu moosukunnaa!', 'That price? I closed my eyes while paying!', 'comedy'],
  ]),

  rent_pay: lines([
    ['bm_rent_pay_1', 'అయ్యో అయ్యో! అద్దె కట్టాలా? నా జేబు ఏడుస్తోంది!', 'Ayyo ayyo! Addhe kattaalaa? Naa jebu edusthondi!', 'Oh no! Rent to pay? My pocket is crying!', 'comedy'],
    ['vk_rent_pay_2', 'సరే సరే, అద్దె కట్టేస్తా. ఇంకోసారి మనదే గెలుపు!', 'Sare sare, addhe kattestaa. Inkosaari manade gelupu!', "Fine, fine, I'll pay the rent. Next time the win is ours!", 'warm'],
    ['pk_rent_pay_3', 'అద్దె కట్టేశా. ఇది ఆటలో భాగమే.', 'Addhe kattesha. Idi aatalo bhaagame.', "Rent paid. It's part of the game.", 'cool'],
    ['pr_rent_pay_4', 'ఫర్వాలేదు, అద్దె కట్టేస్తా. మీరు బాగుండాలి.', 'Farvaaledu, addhe kattestaa. Meeru baagundaali.', "No problem, I'll pay the rent. May you do well.", 'warm'],
    ['rt_rent_pay_5', 'రెంట్ కట్టేశా, నెక్స్ట్ రౌండ్‌లో డబుల్ వసూలు!', 'Rent kattesha, next round lo double vasoolu!', "Paid the rent, I'll collect double next round!", 'mass'],
    ['mb_rent_pay_6', 'అద్దె కట్టేశా. తిరిగి రాబట్టుకుంటా.', 'Addhe kattesha. Thirigi raabattukuntaa.', "Rent paid. I'll win it back.", 'cool'],
  ]),

  rent_receive: lines([
    ['bk_rent_receive_1', 'అద్దె వచ్చింది! గర్జిస్తే గల్లా పెట్టె నిండుతుంది!', 'Addhe vachindi! Garjisthe galla petti nindutundi!', "Rent's in! Roar, and the cash box fills!", 'mass'],
    ['mb_rent_receive_2', 'అద్దె అందింది. థాంక్యూ, మంచి పెట్టుబడి.', 'Addhe andindi. Thank you, manchi pettubadi.', 'Rent received. Thank you, a good investment.', 'cool'],
    ['aa_rent_receive_3', 'రెంట్ వచ్చింది, స్టైల్‌గా జేబులో వేసుకుంటా!', 'Rent vachindi, style ga jebulo vesukuntaa!', "Rent's here, I'll pocket it in style!", 'cool'],
    ['vk_rent_receive_4', 'అద్దె వచ్చింది! ఇంట్లో అందరికీ స్వీట్లు తెస్తా.', 'Addhe vachindi! Intlo andariki sweetlu thestaa.', "Rent's here! I'll bring sweets for everyone at home.", 'warm'],
    ['bm_rent_receive_5', 'ఓహో! అద్దె వచ్చింది, ఇప్పుడు నేను కూడా ఓనర్‌నే!', 'Oho! Addhe vachindi, ippudu nenu kooda owner ne!', "Oho! Rent's here, now I'm an owner too!", 'comedy'],
    ['nt_rent_receive_6', 'ఇది నా ఏరియా, అద్దె నా హక్కు!', 'Idi naa area, addhe naa hakku!', 'This is my area, the rent is my right!', 'mass'],
  ]),

  rent_big: lines([
    ['bm_rent_big_1', 'అమ్మో, ఇది పెద్ద అద్దె! గుండె ఆగినంత పనైంది!', 'Ammo, idi pedda addhe! Gunde aaginantha panaindi!', "Wow, that's a huge rent! My heart nearly stopped!", 'comedy'],
    ['bk_rent_big_2', 'ఇదీ అసలైన అద్దె! ఈ లెక్క గర్జనలా ఉంది!', 'Idee asalaina addhe! Ee lekka garjanalaa undi!', "Now that's real rent! This number roars!", 'mass'],
    ['rc_rent_big_3', 'వావ్, భారీ అద్దె! ఇది ఆటకే పెద్ద మలుపు.', 'Wow, bhaari addhe! Idi aatake pedda malupu.', 'Wow, huge rent! A big turning point in the game.', 'mass'],
    ['rt_rent_big_4', 'ఇదేం రెంట్ రా బాబు! లక్షల్లో ఉన్నట్టుంది!', 'Idem rent raa babu! Lakshallo unnattundi!', 'What a rent, man! Feels like lakhs!', 'comedy'],
    ['pk_rent_big_5', 'పెద్ద మొత్తం. ఆట ఇప్పుడు తీవ్రంగా మారింది.', 'Pedda mottham. Aata ippudu theevramgaa maarindi.', 'A big sum. The game just got serious.', 'cool'],
    ['ng_rent_big_6', 'ఇది భారీ అద్దె. ఇలాంటివే ఆటను మలుపు తిప్పుతాయి.', 'Idi bhaari addhe. Ilaantive aatanu malupu thipputhaayi.', 'A heavy rent. Moments like this turn the game.', 'cool'],
  ]),

  upgrade: lines([
    ['bk_upgrade_1', 'కట్టేద్దాం! ఇటుక ఇటుకకీ గర్జన వినిపించాలి!', 'Kattedaam! Etuka etukaki garjana vinipinchaali!', "Let's build! Every brick should echo the roar!", 'mass'],
    ['rc_upgrade_2', 'అప్‌గ్రేడ్ టైమ్! ఈ బిల్డింగ్ ఇప్పుడు కొత్త లెవెల్‌కి.', 'Upgrade time! Ee building ippudu kotta level ki.', 'Upgrade time! This building goes up a level.', 'mass'],
    ['mb_upgrade_3', 'చిన్న అప్‌గ్రేడ్, పెద్ద లాభం.', 'Chinna upgrade, pedda laabham.', 'A small upgrade, a big profit.', 'cool'],
    ['vk_upgrade_4', 'ఇల్లు కట్టడం అంటే ఒక పండగ! మంచిగా వస్తుంది.', 'Illu kattadam ante oka pandaga! Manchiga vasthundi.', "Building a home is a festival! It'll turn out well.", 'warm'],
    ['aa_upgrade_5', 'కొత్త లుక్, కొత్త రెంట్. స్టైల్ అప్‌గ్రేడ్!', 'Kotta look, kotta rent. Style upgrade!', 'New look, new rent. A style upgrade!', 'cool'],
    ['bm_upgrade_6', 'ఇటుకలు పెట్టాను, ఇప్పుడు నేనే ఇంజనీర్!', 'Itukalu pettaanu, ippudu nenu engineer!', "Laid a few bricks, now I'm the engineer!", 'comedy'],
  ]),

  upgrade_tower: lines([
    ['bk_upgrade_tower_1', 'టవర్ లేచింది! ఆకాశం కూడా సలాం కొడుతుంది!', 'Tower lechindi! Aakaasham kooda salaam kodutundi!', 'The tower has risen! Even the sky salutes!', 'mass'],
    ['ch_upgrade_tower_2', 'ఈ టవర్ హైదరాబాద్ స్కైలైన్‌కి మెగా మెరుపు!', 'Ee tower Hyderabad skyline ki mega merupu!', "This tower is a mega sparkle on Hyderabad's skyline!", 'mass'],
    ['pr_upgrade_tower_3', 'ఆకాశాన్ని తాకే టవర్. ఎంత ఎదిగినా ఒదిగి ఉందాం.', 'Aakaasaanni thaake tower. Entha edigina odigi undaam.', 'A tower touching the sky. Let us stay humble however tall we grow.', 'warm'],
    ['nt_upgrade_tower_4', 'టవర్ తయారు! ఇక ఈ ఏరియాలో నా మాటే చెల్లుతుంది!', 'Tower thayaaru! Ika ee area lo naa maate chellutundi!', 'Tower ready! In this area my word now counts!', 'mass'],
    ['ng_upgrade_tower_5', 'సిటీ స్కైలైన్‌లో కింగ్ సైజ్ టవర్. సొగసుగా ఉంది.', 'City skyline lo king size tower. Sogasuga undi.', 'A king-size tower on the city skyline. Elegant.', 'cool'],
    ['rt_upgrade_tower_6', 'టవర్ రెడీ! రెంట్ మీటర్ రాకెట్ స్పీడ్‌లో తిరుగుతుంది!', 'Tower ready! Rent meter rocket speed lo thiruguthundi!', 'Tower ready! The rent meter spins at rocket speed!', 'mass'],
  ]),

  // upgrade_tower = the level-4 Tower. The level-5 Hotel (the top tier) has its own trigger below.
  upgrade_hotel: lines([
    ['bk_upgrade_hotel_1', 'హోటల్ తయారు! ఇది నా సామ్రాజ్యానికి కిరీటం!', 'Hotel thayaaru! Idi naa saamraajyaaniki kireetam!', 'The hotel is ready! A crown for my empire!', 'mass'],
    ['ch_upgrade_hotel_2', 'గ్రాండ్ హోటల్ ఓపెనింగ్! రిబ్బన్ కట్ చేయండి, మెగా పార్టీ మొదలు!', 'Grand hotel opening! Ribbon cut cheyandi, mega party modalu!', 'Grand hotel opening! Cut the ribbon, the mega party begins!', 'mass'],
    ['mb_upgrade_hotel_3', 'ఫైవ్ స్టార్ హోటల్ రెడీ. క్వాలిటీకి ఇదే సాక్ష్యం.', 'Five star hotel ready. Quality ki ide saakshyam.', 'The five-star hotel is ready. Proof of quality.', 'cool'],
    ['vk_upgrade_hotel_4', 'హోటల్ కట్టేశాం! అతిథులకు మంచి భోజనం పెట్టాలి!', 'Hotel kattesaam! Athithulaku manchi bhojanam pettaali!', 'The hotel is built! We must feed the guests well!', 'warm'],
    ['bm_upgrade_hotel_5', 'హోటల్ కట్టా! ఇక నేనే ఓనర్, నేనే వెయిటర్, నేనే కస్టమర్!', 'Hotel kattaa! Ika nene owner, nene waiter, nene customer!', "Built a hotel! Now I'm the owner, the waiter and the customer!", 'comedy'],
    ['rc_upgrade_hotel_6', 'హోటల్ రెడీ! ఈ ఏరియాలో ఇదే నంబర్ వన్ ల్యాండ్‌మార్క్!', 'Hotel ready! Ee area lo ide number one landmark!', 'Hotel ready! The number one landmark in this area!', 'mass'],
  ]),

  set_complete: lines([
    ['bk_set_complete_1', 'సెట్ మొత్తం నాదే! ఇక ఈ రంగుకి నేనే రాజు!', 'Set mottham naade! Ika ee rangu ki nene raaju!', 'The whole set is mine! I am the king of this colour now!', 'mass'],
    ['aa_set_complete_2', 'కలర్ సెట్ కంప్లీట్! రెంట్ డబుల్, స్టైల్ డబుల్!', 'Colour set complete! Rent double, style double!', 'Colour set complete! Double rent, double style!', 'cool'],
    ['pr_set_complete_3', 'మొత్తం సెట్ నా దగ్గరే ఉంది. ఇక కట్టుకుంటూ వెళ్దాం.', 'Mottham set naa daggare undi. Ika kattukuntu veldaam.', "The whole set is with me. Let's keep building.", 'warm'],
    ['rt_set_complete_4', 'సెట్ పూర్తయింది! ఇక బిల్డింగులు లేపడమే!', 'Set poorthayindi! Ika buildingulu lepadame!', 'Set complete! Now to raise the buildings!', 'mass'],
    ['ng_set_complete_5', 'కలర్ సెట్ కంప్లీట్. ఇప్పుడు అసలైన బిజినెస్ మొదలు.', 'Colour set complete. Ippudu asalaina business modalu.', 'Colour set complete. Now the real business begins.', 'cool'],
    ['bm_set_complete_6', 'ఒరే! సెట్ అంతా నాదేనా? నాకే నమ్మకం కలగడం లేదు!', 'Ore! Set anthaa naadena? Naake nammakam kalagadam ledu!', "Whoa! The whole set is mine? Even I can't believe it!", 'comedy'],
    ['vk_set_complete_7', 'సెట్ కంప్లీట్! పిల్లల చదువుకి ఇక ఢోకా లేదు!', 'Set complete! Pillala chaduvuki ika dhokaa ledu!', 'Set complete! No more worries about the kids\' education!', 'warm'],
  ]),

  mortgage: lines([
    ['bm_mortgage_1', 'అయ్యో, తాకట్టు పెట్టాల్సి వచ్చింది! నా గుండె కూడా తాకట్టులో ఉంది!', 'Ayyo, thaakattu pettaalsi vachindi! Naa gunde kooda thaakattulo undi!', 'Oh no, I had to mortgage it! My heart is mortgaged too!', 'comedy'],
    ['vk_mortgage_2', 'కష్టకాలంలో ఇలాగే చేయాలి. మళ్ళీ విడిపించుకుందాం.', 'Kashtakaalamlo ilaage cheyaali. Malli vidipinchukundaam.', "In hard times this is what you do. We'll redeem it again.", 'warm'],
    ['pk_mortgage_3', 'తాకట్టు పెట్టాను. ఇది తాత్కాలికం, తిరిగి విడిపిస్తా.', 'Thaakattu pettaanu. Idi thaatkaalikam, thirigi vidipisthaa.', "I've mortgaged it. This is temporary, I'll redeem it.", 'cool'],
    ['mb_mortgage_4', 'బ్యాంక్ నుంచి సగం ధర తీసుకున్నా. స్మార్ట్ మూవ్.', 'Bank nunchi sagam dhara theesukunnaa. Smart move.', 'Took half the price from the bank. A smart move.', 'cool'],
    ['rt_mortgage_5', 'తాకట్టు టైమ్! క్యాష్ వచ్చింది, మళ్ళీ రేసులోకి!', 'Thaakattu time! Cash vachindi, malli racelooki!', "Mortgage time! Cash is in, back in the race!", 'mass'],
    ['pr_mortgage_6', 'కొంచెం ఇబ్బంది. కానీ ఫర్వాలేదు, మళ్ళీ నిలబడతా.', 'Konchem ibbandi. Kaani farvaaledu, malli nilabadathaa.', "A little trouble. But it's fine, I'll stand tall again.", 'warm'],
  ]),

  trade_done: lines([
    ['vk_trade_done_1', 'డీల్ ఓకే! ఇద్దరికీ లాభం, ఇదే మంచి వ్యాపారం!', 'Deal ok! Iddarikee laabham, ide manchi vyaapaaram!', 'Deal done! Profit for both, this is good business!', 'warm'],
    ['mb_trade_done_2', 'ట్రేడ్ క్లోజ్. ఇద్దరికీ మంచిదే.', 'Trade close. Iddarikee manchide.', 'Trade closed. Good for both.', 'cool'],
    ['bm_trade_done_3', 'మార్పిడి అయిపోయింది! ఎవరికి లాభమో రేపు తెలుస్తుంది!', 'Maarpidi ayipoyindi! Evariki laabhamo repu telustundi!', "The swap is done! We'll know tomorrow who gained!", 'comedy'],
    ['rc_trade_done_4', 'డీల్ డన్! టీమ్‌వర్క్ అంటే ఇదే.', 'Deal done! Teamwork ante ide.', 'Deal done! This is what teamwork means.', 'mass'],
    ['ng_trade_done_5', 'మంచి డీల్. కింగ్ ఎప్పుడూ లెక్క చూసి మాట్లాడతాడు.', 'Manchi deal. King eppudoo lekka choosi maatlaadathaadu.', 'A good deal. The King always checks the numbers before he talks.', 'cool'],
    ['pr_trade_done_6', 'మనిద్దరికీ మంచి జరిగింది. థాంక్స్ ఫ్రెండ్!', 'Manaddarikee manchi jarigindi. Thanks friend!', 'Something good for both of us. Thanks, friend!', 'warm'],
  ]),

  lucky_dice: lines([
    ['rt_lucky_dice_1', 'డైస్ నా ఫ్రెండే! ఈసారి కూడా సాయం చేశాయి!', 'Dice naa friende! Eesaari kooda saayam chesaayi!', 'The dice are my friends! They helped again!', 'comedy'],
    ['bm_lucky_dice_2', 'ఈ డైస్‌కి నేనంటే ప్రేమ! సాయం చేసినందుకు థాంక్స్!', 'Ee dice ki nenante prema! Saayam chesinanduku thanks!', 'These dice love me! Thanks for the help!', 'comedy'],
    ['vk_lucky_dice_3', 'డైస్ కొంచెం కరుణించాయి!', 'Dice konchem karuninchaayi!', 'The dice showed a little mercy!', 'warm'],
    ['aa_lucky_dice_4', 'లక్కీ డైస్ మన వైపే! స్టైల్‌గా పడ్డాయి.', 'Lucky dice mana vaipe! Style ga paddaayi.', 'The lucky dice are on our side! They fell in style.', 'cool'],
    ['pr_lucky_dice_5', 'డైస్ నాకు తోడు వచ్చాయి. థాంక్యూ డైస్!', 'Dice naaku thodu vachchaayi. Thank you dice!', 'The dice came along for me. Thank you, dice!', 'warm'],
    ['mb_lucky_dice_6', 'లక్కీ డైస్ ఆన్. ఈసారి లెక్క కలిసొచ్చింది.', 'Lucky dice on. Eesaari lekka kalisochindi.', 'Lucky dice on. The numbers worked out this time.', 'cool'],
  ]),

  // ------------------------------------------------------------------ jail, cards, tax, film
  jail: lines([
    ['bm_jail_1', 'జైలా? నేనేం చేశానండి, బిర్యానీ మాత్రమే తిన్నా!', 'Jailaa? Nenem cheshaanandi, biryani maatrame thinnaa!', 'Jail? What did I do, I only ate biryani!', 'comedy'],
    ['vk_jail_2', 'ఒక రౌండ్ జైల్లో, ఏం చేస్తాం, ధైర్యంగా ఉందాం.', 'Oka round jail lo, em chestaam, dhairyamga undaam.', "One round in jail, what to do, let's stay brave.", 'warm'],
    ['pk_jail_3', 'జైల్లో ఒక రోజు. ఆలోచించడానికి మంచి సమయం.', 'Jail lo oka roju. Aalochinchadaniki manchi samayam.', 'A day in jail. A good time to think.', 'cool'],
    ['rt_jail_4', 'జైలు ఎంట్రీ! బయటికి వచ్చాక డబుల్ స్పీడ్!', 'Jail entry! Bayatiki vachchaaka double speed!', 'Jail entry! Double speed once I am out!', 'mass'],
    ['bk_jail_5', 'జైలు గోడలు ఎంత ఎత్తైనా సరే, సింహం బయటికి వస్తుంది!', 'Jailu godalu entha ethainaa sare, simham bayatiki vasthundi!', 'However high the jail walls, the lion will come out!', 'mass'],
  ]),

  jail_free: lines([
    ['bm_jail_free_1', 'హమ్మయ్య! బయటికి వచ్చా, ఇక బిర్యానీ పార్టీ!', 'Hammayya! Bayatiki vachchaa, ika biryani party!', 'Phew! I am out, now a biryani party!', 'comedy'],
    ['rc_jail_free_2', 'ఫ్రీడమ్! ఇక మెగా కమ్‌బ్యాక్ మొదలు.', 'Freedom! Ika mega comeback modalu.', 'Freedom! Now the mega comeback begins.', 'mass'],
    ['aa_jail_free_3', 'బయటికి వచ్చేశా! ఇప్పుడు ఆట కొత్త స్టైల్‌లో.', 'Bayatiki vachchesha! Ippudu aata kotta style lo.', 'I am out! Now the game gets a new style.', 'cool'],
    ['ng_jail_free_4', 'జైలు నుంచి బయటకు. కూల్‌గా తిరిగి వచ్చా.', 'Jailu nunchi bayataku. Cool ga thirigi vachchaa.', 'Out of jail. Back, nice and cool.', 'cool'],
    ['vk_jail_free_5', 'హమ్మయ్య, ఇంటికి వచ్చినంత హాయిగా ఉంది!', 'Hammayya, intiki vachchinantha haayiga undi!', 'Phew, it feels as good as coming home!', 'warm'],
  ]),

  card_good: lines([
    ['vk_card_good_1', 'కిస్మత్ కలిసొచ్చింది! ఇది పండగ రోజు!', 'Kismet kalisochindi! Idi pandaga roju!', "Kismet is on my side! It's a festival day!", 'warm'],
    ['pr_card_good_2', 'అదృష్టం నవ్వింది. అందరితో పంచుకుంటా.', 'Adrushtam navvindi. Andarithoo panchukuntaa.', 'Luck smiled. I will share it with everyone.', 'warm'],
    ['rt_card_good_3', 'కార్డ్ సూపర్! లక్ నా జేబులోకి దూకింది!', 'Card super! Luck naa jebuloki dookindi!', 'Super card! Luck jumped into my pocket!', 'mass'],
    ['ch_card_good_4', 'అదృష్టం కూడా నా అభిమానే!', 'Adrushtam kooda naa abhimaane!', 'Even luck is my fan!', 'mass'],
    ['bk_card_good_5', 'కిస్మత్ గర్జించింది! ఈ రోజు మనదే!', 'Kismet garjinchindi! Ee roju manade!', 'Kismet has roared! Today is ours!', 'mass'],
  ]),

  card_bad: lines([
    ['bm_card_bad_1', 'అయ్యో కిస్మత్! బిర్యానీలో ఉప్పు ఎక్కువైనట్టు ఉంది!', 'Ayyo kismet! Biryanilo uppu ekkuvainattu undi!', 'Oh kismet! Feels like too much salt in the biryani!', 'comedy'],
    ['mb_card_bad_2', 'ఓ చిన్న ఎదురుదెబ్బ. తిరిగి వస్తాను.', 'O chinna edurudebba. Thirigi vasthaanu.', "A small setback. I'll be back.", 'cool'],
    ['pk_card_bad_3', 'ఈసారి కార్డు ఇలా పడింది. పర్వాలేదు.', 'Eesaari card ilaa padindi. Parvaaledu.', "The card fell this way this time. It's okay.", 'cool'],
    ['vk_card_bad_4', 'కిస్మత్ కొంచెం కోపంగా ఉంది. నవ్వుతూ ముందుకెళ్దాం.', 'Kismet konchem kopamga undi. Navvuthu mundukeldaam.', "Kismet is a bit angry. Let's move on smiling.", 'warm'],
    ['rt_card_bad_5', 'ఓరి నాయనో! కార్డ్ నన్ను ట్రోల్ చేసింది!', 'Ori naayano! Card nannu troll chesindi!', 'Oh my! The card trolled me!', 'comedy'],
  ]),

  tax: lines([
    ['bm_tax_1', 'ట్యాక్సా? నా జేబులో చిల్లర కూడా లేదు సార్!', 'Taxaa? Naa jebulo chillara kooda ledu saar!', "Tax? I don't even have change in my pocket, sir!", 'comedy'],
    ['vk_tax_2', 'పన్ను కట్టడం బాధ్యత. కానీ కొంచెం భారంగానే ఉంది!', 'Pannu kattadam baadhyata. Kaani konchem bhaaramgaane undi!', "Paying tax is a duty. But it's a bit heavy!", 'warm'],
    ['pk_tax_3', 'పన్ను కట్టేశా. లెక్కలు నీట్‌గా ఉంటే నిద్ర బాగా పడుతుంది.', 'Pannu kattesha. Lekkalu neat ga unte nidra baaga padutundi.', 'Tax paid. Neat accounts mean sound sleep.', 'cool'],
    ['mb_tax_4', 'ప్రాపర్టీ ట్యాక్స్. బిజినెస్‌లో ఇది కూడా ఒక భాగం.', 'Property tax. Business lo idi kooda oka bhaagam.', "Property tax. It's also part of business.", 'cool'],
    ['rt_tax_5', 'ఆస్తి పన్ను కట్టేశా, జేబు తేలికైపోయింది బాబూ!', 'Aasthi pannu kattesha, jebu thelikaipoyindi baabu!', 'Paid the property tax, my pocket got light!', 'comedy'],
  ]),

  film: lines([
    ['ch_film_1', 'కెమెరా రోల్ అయింది! ఈ మెగా కామియో నాదే!', 'Camera roll ayindi! Ee mega cameo naade!', 'Camera rolling! This mega cameo is mine!', 'mass'],
    ['aa_film_2', 'ఫిల్మ్ సిటీలో స్టైలిష్ ఎంట్రీ, ఫీజు కూడా వచ్చింది!', 'Film City lo stylish entry, fee kooda vachindi!', 'A stylish entry at Film City, and the fee came too!', 'cool'],
    ['rt_film_3', 'లైట్స్, కెమెరా, యాక్షన్! ఫీజు జేబులోకి!', 'Lights, camera, action! Fee jebuloki!', 'Lights, camera, action! Fee into the pocket!', 'mass'],
    ['bm_film_4', 'కామియో చేశా, ఫీజు తీసుకున్నా, ఇక నేనే సూపర్‌స్టార్!', 'Cameo chesha, fee theesukunnaa, ika nene superstar!', "Did a cameo, took the fee, now I'm the superstar!", 'comedy'],
    ['bk_film_5', 'కెమెరా ముందు నా గర్జనకు ఫీజు వచ్చింది!', 'Camera mundu naa garjanaku fee vachindi!', 'I got paid for my roar in front of the camera!', 'mass'],
    ['mb_film_6', 'షాట్ రెడీ, టేక్ ఒకటే. ఫీజు అందింది.', 'Shot ready, take okate. Fee andindi.', 'Shot ready, one take. Fee received.', 'cool'],
  ]),

  // ------------------------------------------------------------------ auctions
  auction_start: lines([
    ['bm_auction_start_1', 'వేలం మొదలైంది! నా జేబులో ఏముందో నాకే తెలియదు!', 'Velam modalaindi! Naa jebulo emundo naake teliyadu!', "The auction has started! Even I don't know what's in my pocket!", 'comedy'],
    ['rt_auction_start_2', 'వేలం టైమ్! రేటు పెంచండి, స్పీడ్‌గా!', 'Velam time! Rate penchandi, speed ga!', 'Auction time! Raise the rate, quickly!', 'mass'],
    ['ng_auction_start_3', 'వేలం మొదలు. తెలివైన బిడ్ గెలుస్తుంది.', 'Velam modalu. Telivaina bid gelustundi.', 'The auction begins. The smart bid wins.', 'cool'],
    ['vk_auction_start_4', 'లాడ్ బజార్‌లో వేలం! ఇంకెవరైనా ఉన్నారా?', 'Laad Bazaar lo velam! Inkevaraina unnaaraa?', 'An auction at Laad Bazaar! Anyone else in?', 'warm'],
    ['rc_auction_start_5', 'వేలం టైమ్, బిడ్ వేద్దాం, గేమ్ ఆన్!', 'Velam time, bid veddaam, game on!', "Auction time, let's bid, game on!", 'mass'],
  ]),

  auction_win: lines([
    ['bk_auction_win_1', 'వేలం నాదే! సింహం గర్జనకు ఎవరూ ఎదురు నిలవలేరు!', 'Velam naade! Simham garjanaku evaruu eduru nilavaleru!', 'The auction is mine! No one can stand against the lion\'s roar!', 'mass'],
    ['aa_auction_win_2', 'వేలం గెలిచాను! ఈ స్థలం ఇప్పుడు నా స్టైల్‌లో.', 'Velam gelichaanu! Ee sthalam ippudu naa style lo.', 'Won the auction! This plot is in my style now.', 'cool'],
    ['pr_auction_win_3', 'వేలం గెలిచాను, థాంక్యూ అందరికీ. మంచి ఉపయోగం చేస్తా.', 'Velam gelichaanu, thank you andariki. Manchi upayogam chestaa.', "Won the auction, thank you all. I'll put it to good use.", 'warm'],
    ['mb_auction_win_4', 'బిడ్ సరైన టైమ్‌లో వేశా. డీల్ నాదే.', 'Bid sarainaa time lo vesha. Deal naade.', 'Placed the bid at the right time. The deal is mine.', 'cool'],
    ['bm_auction_win_5', 'వేలం గెలిచానా? ఎవరికీ చెప్పొద్దు, నాకే భయం వేస్తోంది!', 'Velam gelichaanaa? Evariki cheppoddu, naake bhayam vesthondi!', "I won the auction? Don't tell anyone, I'm scared myself!", 'comedy'],
  ]),

  auction_lose: lines([
    ['bm_auction_lose_1', 'అయ్యో! వేలం పోయింది, నా ఆశ కూడా పోయింది!', 'Ayyo! Velam poyindi, naa aasha kooda poyindi!', 'Oh no! The auction is gone and so is my hope!', 'comedy'],
    ['vk_auction_lose_2', 'ఈసారి కాదు, వచ్చేసారి చూద్దాం. నవ్వుతూనే ఉందాం!', 'Eesaari kaadu, vachchesaari chooddaam. Navvuthune undaam!', "Not this time, we'll see next time. Let's keep smiling!", 'warm'],
    ['pk_auction_lose_3', 'ఈ బిడ్ పోయింది. తదుపరి అవకాశం కోసం చూస్తా.', 'Ee bid poyindi. Thadupari avakaasham kosam choostaa.', "Lost this bid. I'll look for the next chance.", 'cool'],
    ['ch_auction_lose_4', 'ఒక వేలం పోతే ఏమి? స్టేజ్ ఇంకా మిగిలే ఉంది.', 'Oka velam pothe emi? Stage inka migile undi.', 'So what if one auction is lost? The stage is still there.', 'mass'],
    ['rt_auction_lose_5', 'ఓహో! రేటు తక్కువ వేశానా? మళ్ళీ ఫాస్ట్‌గా రికవర్ అవుతా!', 'Oho! Rate takkuva veshaanaa? Malli fast ga recover avuthaa!', 'Oho! Did I bid too low? I will bounce back fast!', 'comedy'],
  ]),

  // ------------------------------------------------------------------ the end
  bankrupt: lines([
    ['bm_bankrupt_1', 'అయ్యో దేవుడా! దివాలా తీశా! నా దగ్గర ఇప్పుడు నవ్వు మాత్రమే మిగిలింది!', 'Ayyo devudaa! Divaalaa theesha! Naa daggara ippudu navvu maatrame migilindi!', "Oh god! I'm bankrupt! Only my smile is left!", 'comedy'],
    ['vk_bankrupt_2', 'ఆట ఓడినా మనసు గెలిచాను, మళ్ళీ కలుద్దాం.', 'Aata odinaa manasu gelichaanu, malli kaluddaam.', 'I lost the game but won hearts, see you again.', 'warm'],
    ['pr_bankrupt_3', 'అందరికీ శుభాకాంక్షలు. మంచి ఆట ఆడారు. నాకు ఇదే చాలు.', 'Andariki shubhaakaankshalu. Manchi aata aadaaru. Naaku ide chaalu.', 'Best wishes to all. You played well. That is enough for me.', 'warm'],
    ['pk_bankrupt_4', 'ఈ ఆట ముగిసింది. పాఠం నేర్చుకున్నా.', 'Ee aata mugisindi. Paatham nerchukunnaa.', 'This game is over. I learned a lesson.', 'cool'],
    ['rt_bankrupt_5', 'బ్యాంక్ ఖాళీ, కానీ ఎనర్జీ ఫుల్! మళ్ళీ వస్తా!', 'Bank khaali, kaani energy full! Malli vastaa!', 'Bank empty, but energy full! I will be back!', 'comedy'],
  ]),

  win_me: lines([
    ['bk_win_me_1', 'గెలుపు గర్జన! ఈ సిటీ మొత్తం నా కోటే!', 'Gelupu garjana! Ee city mottham naa kote!', 'The roar of victory! The whole city is my fortress!', 'mass'],
    ['ch_win_me_2', 'విజయం మెగా స్టైల్‌లో! మీ అందరి ప్రేమకు థాంక్స్!', 'Vijayam mega style lo! Mee andari premaku thanks!', 'Victory in mega style! Thanks for all your love!', 'mass'],
    ['mb_win_me_3', 'గెలిచాం. చాలా ప్రశాంతంగా, చాలా సంతోషంగా.', 'Gelichaam. Chaalaa prashaanthamga, chaalaa santhoshamga.', 'We won. Very calmly, very happily.', 'cool'],
    ['aa_win_me_4', 'టైటిల్ నాదే! ఇది స్టైలిష్ విక్టరీ!', 'Title naade! Idi stylish victory!', 'The title is mine! A stylish victory!', 'cool'],
    ['nt_win_me_5', 'విజయం నా చేతిలో! ఇక హైదరాబాద్ నా అడ్డా!', 'Vijayam naa chethilo! Ika Hyderabad naa addaa!', 'Victory in my hands! Hyderabad is now my turf!', 'mass'],
    ['vk_win_me_6', 'గెలిచాం! ఇంటిల్లిపాదికీ పార్టీ!', 'Gelichaam! Intillipaadiki party!', 'We won! A party for the whole family!', 'warm'],
    ['pr_win_me_7', 'గెలిచాను! కానీ ఈ విజయం మీ అందరిదీ.', 'Gelichaanu! Kaani ee vijayam mee andaridee.', 'I won! But this victory belongs to all of you.', 'warm'],
  ]),

  win_other: lines([
    ['bm_win_other_1', 'అయ్యో, వాళ్ళు గెలిచారు! ఇక వాళ్ళే బిర్యానీ కొనాలి!', 'Ayyo, vaallu gelichaaru! Ika vaalle biryani konaali!', 'Oh no, they won! Now they must buy the biryani!', 'comedy'],
    ['vk_win_other_2', 'శభాష్! బాగా ఆడారు, తదుపరి ఆటలో కలుద్దాం.', 'Shabaash! Baaga aadaaru, thadupari aatalo kaluddaam.', "Well done! You played well, let's meet in the next game.", 'warm'],
    ['pr_win_other_3', 'గెలిచిన వారికి శుభాకాంక్షలు. అందరూ బాగా ఆడారు.', 'Gelichina vaariki shubhaakaankshalu. Andaruu baaga aadaaru.', 'Congratulations to the winner. Everyone played well.', 'warm'],
    ['mb_win_other_4', 'మంచి ఆట. విజేతకు అభినందనలు.', 'Manchi aata. Vijethaku abhinandanalu.', 'A good game. Congratulations to the winner.', 'cool'],
    ['rt_win_other_5', 'వావ్, ఏం ఆట! నెక్స్ట్ మ్యాచ్‌లో నేనే!', 'Wow, em aata! Next match lo nene!', 'Wow, what a game! Next match is mine!', 'mass'],
    ['ng_win_other_6', 'కూల్ విన్. కంగ్రాట్స్, ఈసారికి నీదే.', 'Cool win. Congrats, eesaariki neede.', 'A cool win. Congrats, this round is yours.', 'cool'],
  ]),

  // ------------------------------------------------------------------ soundboard (emotes the player taps)
  emote_mass: lines([
    ['bk_emote_mass_1', 'మాస్ అంటే ఇదే!', 'Mass ante ide!', 'This is what mass means!', 'mass'],
    ['nt_emote_mass_2', 'ఇక సునామీ మొదలు!', 'Ika sunaami modalu!', 'Now the tsunami begins!', 'mass'],
    ['rt_emote_mass_3', 'మాస్ మోడ్ ఆన్!', 'Mass mode on!', 'Mass mode on!', 'mass'],
    ['aa_emote_mass_4', 'ఇది స్టైల్ తుఫాను!', 'Idi style thufaanu!', 'This is a storm of style!', 'mass'],
    ['ch_emote_mass_5', 'బాస్ వచ్చాడు, దారి ఇవ్వండి!', 'Boss vachchaadu, daari ivvandi!', 'The boss has arrived, make way!', 'mass'],
    ['rc_emote_mass_6', 'మెగా ఎనర్జీ ఫుల్ ఛార్జ్!', 'Mega energy full charge!', 'Mega energy at full charge!', 'mass'],
  ]),

  emote_cheer: lines([
    ['vk_emote_cheer_1', 'శభాష్, భలే ఆడావు!', 'Shabaash, bhale aadaavu!', 'Well done, you played brilliantly!', 'warm'],
    ['pr_emote_cheer_2', 'సూపర్! చాలా బాగుంది!', 'Super! Chaalaa baagundi!', 'Super! That was really good!', 'warm'],
    ['ch_emote_cheer_3', 'బ్రావో! అదిరింది!', 'Bravo! Adirindi!', 'Bravo! That was stunning!', 'mass'],
    ['rt_emote_cheer_4', 'వావ్ వావ్! సూపర్ మూవ్!', 'Wow wow! Super move!', 'Wow wow! Super move!', 'mass'],
    ['ng_emote_cheer_5', 'నైస్ ప్లే!', 'Nice play!', 'Nice play!', 'cool'],
    ['rc_emote_cheer_6', 'అదిరిపోయింది! ఇలాగే కొనసాగించు!', 'Adiripoyindi! Ilaage konasaaginchu!', 'Fantastic! Keep it up!', 'mass'],
  ]),

  emote_shock: lines([
    ['bm_emote_shock_1', 'అమ్మో! ఇది నిజమా?', 'Ammo! Idi nijamaa?', 'Oh my! Is this real?', 'comedy'],
    ['vk_emote_shock_2', 'అరె బాబోయ్!', 'Are baaboy!', 'Oh my goodness!', 'comedy'],
    ['rt_emote_shock_3', 'ఏంటి రా ఇది!', 'Enti raa idi!', 'What is this, man!', 'comedy'],
    ['pr_emote_shock_4', 'అయ్యో, ఇది ఊహించలేదు!', 'Ayyo, idi oohinchaledu!', "Oh, I didn't expect this!", 'warm'],
    ['mb_emote_shock_5', 'ఇది ఊహించలేదు.', 'Idi oohinchaledu.', "I didn't see this coming.", 'cool'],
    ['nt_emote_shock_6', 'వామ్మో! ఏం ట్విస్ట్ ఇది!', 'Vaammo! Em twist idi!', 'Wow! What a twist!', 'mass'],
  ]),

  emote_laugh: lines([
    ['bm_emote_laugh_1', 'హ హ హ! నవ్వి నవ్వి కడుపు నొప్పి వస్తోంది!', 'Ha ha ha! Navvi navvi kadupu noppi vasthondi!', "Ha ha ha! I'm laughing so much my stomach hurts!", 'comedy'],
    ['vk_emote_laugh_2', 'భలే భలే! నవ్వు ఆగట్లేదు!', 'Bhale bhale! Navvu aagatledu!', "Great, great! I can't stop laughing!", 'comedy'],
    ['rt_emote_laugh_3', 'హ హ! ఇది సూపర్ కామెడీ!', 'Ha ha! Idi super comedy!', 'Ha ha! This is super comedy!', 'comedy'],
    ['aa_emote_laugh_4', 'హా హా! నన్ను నవ్వించారు!', 'Haa haa! Nannu navvinchaaru!', 'Ha ha! You made me laugh!', 'comedy'],
    ['pr_emote_laugh_5', 'హ హ హ, భలే చెప్పారు!', 'Ha ha ha, bhale cheppaaru!', 'Ha ha ha, well said!', 'warm'],
  ]),

  emote_thanks: lines([
    ['pr_emote_thanks_1', 'ధన్యవాదాలు, మీరు గ్రేట్!', 'Dhanyavaadaalu, meeru great!', 'Thank you, you are great!', 'warm'],
    ['vk_emote_thanks_2', 'చాలా థాంక్స్ అండీ!', 'Chaalaa thanks andee!', 'Many thanks!', 'warm'],
    ['mb_emote_thanks_3', 'థాంక్యూ. ఇది గుర్తుంచుకుంటా.', 'Thank you. Idi gurthunchukuntaa.', "Thank you. I'll remember this.", 'cool'],
    ['ch_emote_thanks_4', 'మీ ప్రేమకు వందనం!', 'Mee premaku vandanam!', 'My respects for your love!', 'warm'],
    ['rc_emote_thanks_5', 'థాంక్యూ ఫ్రెండ్స్!', 'Thank you friends!', 'Thank you, friends!', 'warm'],
  ]),

  emote_hurry: lines([
    ['rt_emote_hurry_1', 'త్వరగా కానివ్వండి, టైమ్ అయిపోతోంది!', 'Tvaragaa kaanivvandi, time ayipothondi!', 'Hurry up, time is running out!', 'mass'],
    ['bm_emote_hurry_2', 'త్వరగా రా బాబూ, నా బిర్యానీ చల్లారిపోతోంది!', 'Tvaragaa raa baabu, naa biryani challaaripothondi!', 'Hurry up, my biryani is getting cold!', 'comedy'],
    ['aa_emote_hurry_3', 'రోల్ చేయ్, స్టైల్ తర్వాత చూపిద్దాం!', 'Roll cheyyi, style tharvaatha choopiddaam!', "Roll it, we'll show the style later!", 'cool'],
    ['bk_emote_hurry_4', 'ఆలస్యం వద్దు, డైస్ వేయండి!', 'Aalasyam vaddu, dice veyandi!', 'No delay, roll the dice!', 'mass'],
    ['vk_emote_hurry_5', 'తొందరగా వేయండి, భోజనం టైమ్ అవుతోంది!', 'Thondaraga veyandi, bhojanam time avuthondi!', "Roll quickly, it's almost lunchtime!", 'warm'],
  ]),

  emote_taunt: lines([
    ['rt_emote_taunt_1', 'నన్ను పట్టుకోండి చూద్దాం!', 'Nannu pattukondi chooddaam!', "Catch me if you can!", 'mass'],
    ['aa_emote_taunt_2', 'ఈసారి కూడా నేనే ముందు!', 'Eesaari kooda nene mundu!', 'I am ahead this time too!', 'cool'],
    ['ch_emote_taunt_3', 'ఇది ఇంకా ట్రైలర్ మాత్రమే!', 'Idi inka trailer maatrame!', 'This is only the trailer!', 'mass'],
    ['bk_emote_taunt_4', 'ఈ ఆటలో నన్ను ఆపడం మీ వల్ల కాదు!', 'Ee aatalo nannu aapadam mee valla kaadu!', "You can't stop me in this game!", 'mass'],
    ['nt_emote_taunt_5', 'ధైర్యం ఉంటే నా ఏరియాకి రండి!', 'Dhairyam unte naa area ki randi!', 'Come to my area if you dare!', 'mass'],
    ['mb_emote_taunt_6', 'నా ప్లాన్ ముందు మీ ప్లాన్ చిన్నదే, ఫ్రెండ్స్.', 'Naa plan mundu mee plan chinnade, friends.', 'Next to my plan yours is small, friends.', 'cool'],
    ['bm_emote_taunt_7', 'నన్ను ఓడిస్తారా? ముందు నా బిర్యానీ తిని చూడండి!', 'Nannu odistaaraa? Mundu naa biryani thini choodandi!', 'Beat me? First try my biryani!', 'comedy'],
  ]),
};
