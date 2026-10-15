export const dimensions = [
  {key:'W_O',code:'O',group:'Big Five',groupKey:'big5',short:'ความคิดใหม่ · จินตนาการ',detail:'ความสนใจในความคิดส�[... ]'},
  {key:'W_C',code:'C',group:'Big Five',groupKey:'big5',short:'วางแผน · ทำต่อเนื่อง',detail:'การวางแผน ความมีวินัย ��[... ]'},
  {key:'W_E',code:'E',group:'Big Five',groupKey:'big5',short:'มีพลังเมื่อได้พบผู้คน',detail:'พลังและความมั่นใจเ��[... ]'},
  {key:'W_A',code:'A',group:'Big Five',groupKey:'big5',short:'เข้าใจผู้อื่น · ประนีประนอม',detail:'การคำนึงถึงควา�[... ]'},
  {key:'W_N_High',code:'N+',group:'Big Five',groupKey:'big5',short:'การตอบสนองต่อความกดด[... ]',detail:'ความไวต่อความกดดันทางอารมณ์และความคิดเชิงประเมิน'},
  {key:'W_N_Low',code:'N−',group:'Big Five',groupKey:'big5',short:'กลับทิศจากข้อ N+',detail:'อารมณ์มั่นคงและคงที่'},
  {key:'W_R',code:'R',group:'RIASEC',groupKey:'riasec',short:'เครื่องมือ · ห้องปฏิบัติการ',detail:'ความชอบในการทำสิ่งที่จับต้องได้และลงมือปฏิบัติ'},
  {key:'W_I',code:'I',group:'RIASEC',groupKey:'riasec',short:'วิเคราะห์ · วิจัย',detail:'ความชอบตั้งคำถามและสำรวจข้อมูล'},
  {key:'W_A_ria',code:'A',group:'RIASEC',groupKey:'riasec',short:'ออกแบบ · สื่อสารอิสระ',detail:'ความชอบในการสร้างสรรค์และแสดงออก'},
  {key:'W_S',code:'S',group:'RIASEC',groupKey:'riasec',short:'สอน · ดูแล · ให้คำปรึกษา',detail:'ความพึงพอใจในการช่วยเหลือผู้อื่น'},
  {key:'W_E_ria',code:'E',group:'RIASEC',groupKey:'riasec',short:'นำทีม · โน้มน้าว',detail:'ความชอบในการริเริ่มและนำคน'},
  {key:'W_C_ria',code:'C',group:'RIASEC',groupKey:'riasec',short:'ข้อมูล · ความถูกต้อง',detail:'ความชอบในการจัดระเบียบและทำงานอย่างมีระบบ'},
  {key:'W_Logical',code:'MI-L',group:'พหุปัญญา',groupKey:'mi',short:'แยกปัญหาเป็นขั้นตอน · เห็นรูปแบบ',detail:'ความถนัดด้านตรรกะและคณิตศาสตร์'},
  {key:'W_Linguistic',code:'MI-LG',group:'พหุปัญญา',groupKey:'mi',short:'อ่านจับประเด็น · สื่อสาร',detail:'ความถนัดด้านภาษามนุษย์และการสื่อสาร'},
  {key:'W_Spatial',code:'MI-SP',group:'พหุปัญญา',groupKey:'mi',short:'จินตภาพ · โครงสร้างสามมิติ',detail:'ความถนัดด้านมิติสัมพันธ์และการมองภาพ'},
  {key:'W_Interpersonal',code:'MI-PE',group:'พหุปัญญา',groupKey:'mi',short:'เข้าใจอารมณ์ · ประสานสัมพันธ์',detail:'ความถนัดด้านมนุษยสัมพันธ์และการเข้าใจผู้อื่น'},
  {key:'W_Intrapersonal',code:'MI-PI',group:'พหุปัญญา',groupKey:'mi',short:'สะท้อนคิด · รู้เป้าหมาย',detail:'ความถนัดด้านความเข้าใจตนเองและการวิเคราะห์ตนเอง'},
  {key:'W_Naturalistic',code:'MI-NA',group:'พหุปัญญา',groupKey:'mi',short:'สังเกต · จัดจำแนกธรรมชาติ',detail:'ความถนัดด้านธรรมชาติวิทยาและสิ่งมีชีวิต'},
  {key:'MI_Musical',code:'MI-MU',group:'พหุปัญญา',groupKey:'mi',short:'เสียง · จังหวะ · ทำนอง',detail:'ความถนัดด้านดนตรีและเสียง'},
  {key:'MI_Bodily',code:'MI-BK',group:'พหุปัญญา',groupKey:'mi',short:'การลงมือทำ · การเคลื่อนไหว',detail:'ความถนัดด้านร่างกายและการเคลื่อนไหว'}
];
export const dimensionByKey=Object.fromEntries(dimensions.map(d=>[d.key,d]));
export const groupLabels={big5:'บุคลิกภาพ · Big Five',riasec:'ความสนใจ · RIASEC',mi:'ความถนัด · พหุปัญญา'};
