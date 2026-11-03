import { test,expect,type Page } from '@playwright/test';
type Role='ADMIN'|'TEACHER'|'STUDENT';
const configured=!!process.env.E2E_COURSE_ID&&['ADMIN','TEACHER','STUDENT'].every((r)=>process.env[`E2E_${r}_USERNAME`]&&process.env[`E2E_${r}_PASSWORD`]);
const stamp=Date.now();
const assignment=`E2E assignment ${stamp}`,quiz=`E2E quiz ${stamp}`,announcement=`E2E announcement ${stamp}`,complaint=`E2E concern ${stamp}`;
const passwords:Partial<Record<Role,string>>={};
async function login(page:Page,role:Role){
  await page.goto('/login');await page.getByLabel('Username',{exact:true}).fill(process.env[`E2E_${role}_USERNAME`]!);
  await page.getByLabel('LMS password',{exact:true}).fill(passwords[role]??process.env[`E2E_${role}_PASSWORD`]!);await page.getByRole('button',{name:'Sign in to workspace'}).click();
  await page.waitForURL(/\/((admin|teacher|student)\/dashboard|change-password)$/);
  if(page.url().endsWith('/change-password')){
    const updated=`E2eUpdated${stamp}!`;await page.getByLabel('Current password',{exact:true}).fill(passwords[role]??process.env[`E2E_${role}_PASSWORD`]!);
    await page.getByLabel('New password',{exact:true}).fill(updated);await page.getByLabel('Confirm password',{exact:true}).fill(updated);await page.getByRole('button',{name:'Update password'}).click();
    passwords[role]=updated;await page.waitForURL(/\/login$/);await login(page,role);
  }
}
async function course(page:Page){if(process.env.E2E_COURSE_ID)await page.getByLabel('Current course').selectOption(process.env.E2E_COURSE_ID);}
test.describe.serial('Real Supabase workflows (local test project only)',()=>{
  test.skip(!configured,'Set all three role account variables and E2E_COURSE_ID for a shared course in a seeded test database. These flows create test content.');
  test('1 · internal login redirects by role; signup is absent',async({page})=>{await login(page,'STUDENT');await expect(page).toHaveURL(/\/student\/dashboard$/);await page.goto('/signup');await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();});
  test('2 · assigned teacher uploads a private resource',async({page})=>{
    await login(page,'TEACHER');await course(page);await page.getByRole('link',{name:'Resources',exact:true}).click();await page.getByRole('button',{name:'Upload resource',exact:true}).click();
    await page.getByLabel('Resource title').fill(`Notes ${stamp}`);await page.getByLabel('Choose attachment').setInputFiles({name:'notes.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTest learning resource')});await page.getByRole('dialog').getByRole('button',{name:'Upload resource',exact:true}).click();await expect(page.getByRole('heading',{name:`Notes ${stamp}`})).toBeVisible();
  });
  test('3 · student sees assigned courses',async({page})=>{await login(page,'STUDENT');await page.getByRole('link',{name:'My courses',exact:true}).click();await expect(page.locator('.course-card').first()).toBeVisible();});
  test('4a · teacher creates coursework',async({page})=>{
    await login(page,'TEACHER');await course(page);await page.getByRole('link',{name:'Assignments',exact:true}).click();await page.getByRole('button',{name:'Create assignment',exact:true}).click();await page.getByLabel('Assignment title').fill(assignment);await page.getByLabel('Instructions').fill('Explain binary search.');await page.getByLabel('Maximum marks').fill('20');await page.getByLabel('Due date').fill('2030-01-01T12:00');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('heading',{name:assignment})).toBeVisible();
  });
  test('4b · student submits text for an assignment',async({page})=>{
    await login(page,'STUDENT');await course(page);await page.getByRole('link',{name:'Assignments',exact:true}).click();await page.locator('article').filter({has:page.getByRole('heading',{name:assignment})}).getByRole('button',{name:'Open assignment'}).click();await page.getByLabel('Your answer').fill('Binary search repeatedly halves a sorted search space.');await page.getByRole('button',{name:'Submit work',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
  });
  test('5a · teacher builds and publishes a timed quiz',async({page})=>{
    await login(page,'TEACHER');await course(page);await page.getByRole('link',{name:'Quizzes',exact:true}).click();await page.getByRole('button',{name:'Build quiz'}).click();await page.getByLabel('Quiz title').fill(quiz);await page.getByLabel('Opens at').fill('2026-01-01T09:00');await page.getByLabel('Closes at').fill('2030-01-01T12:00');await page.getByLabel('Visibility').selectOption('true');await page.getByLabel('Question prompt').fill('Which complexity describes binary search?');await page.getByLabel('Question 1 option 1',{exact:true}).fill('O(n)');await page.getByLabel('Question 1 option 2',{exact:true}).fill('O(log n)');await page.getByLabel('Option 2 is correct',{exact:true}).check();await page.getByRole('button',{name:'Create quiz',exact:true}).click();await expect(page.getByRole('heading',{name:quiz})).toBeVisible();
  });
  test('5b · student attempts once and sees the server score',async({page})=>{
    await login(page,'STUDENT');await course(page);await page.getByRole('link',{name:'Quizzes',exact:true}).click();page.on('dialog',(dialog)=>dialog.accept());await page.locator('article').filter({has:page.getByRole('heading',{name:quiz})}).getByRole('button',{name:'Start quiz'}).click();await page.getByLabel('O(log n)',{exact:true}).check();await page.getByRole('button',{name:'Submit quiz',exact:true}).click();await expect(page.getByRole('heading',{name:'Your score: 1'})).toBeVisible();
  });
  test('6 · teacher posts a course announcement',async({page})=>{
    await login(page,'TEACHER');await course(page);await page.getByRole('link',{name:'Announcements',exact:true}).click();await page.getByRole('button',{name:'Post announcement',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill(announcement);await page.getByLabel('Announcement',{exact:true}).fill('Our next learning milestone is ready.');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('heading',{name:announcement})).toBeVisible();
  });
  test('7 · student sees quiz marks with totals',async({page})=>{await login(page,'STUDENT');await course(page);await page.getByRole('link',{name:'My marks',exact:true}).click();await expect(page.getByRole('cell',{name:quiz,exact:true})).toBeVisible();await expect(page.locator('.marks-summary')).toBeVisible();});
  test('8 · a classroom message arrives for another member without refresh',async({page,browser})=>{
    await login(page,'TEACHER');await course(page);await page.getByRole('link',{name:'Classroom chat',exact:true}).click();const context=await browser.newContext();const student=await context.newPage();await login(student,'STUDENT');await course(student);await student.getByRole('link',{name:'Classroom chat',exact:true}).click();const message=`Hello classroom ${stamp}`;await page.getByLabel('Message',{exact:true}).fill(message);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(student.getByText(message,{exact:true})).toBeVisible({timeout:2000});await context.close();
  });
  test('9a · a student files a private complaint',async({page})=>{
    await login(page,'STUDENT');await page.getByRole('link',{name:'Complaints',exact:true}).click();await page.getByRole('button',{name:'Raise a complaint',exact:true}).click();await page.getByLabel('Subject',{exact:true}).fill(complaint);await page.getByLabel('Describe your concern').fill('The classroom projector needs attention.');await page.getByRole('button',{name:'Submit complaint'}).click();await expect(page.getByRole('heading',{name:complaint})).toBeVisible();
  });
  test('9b · administrator reviews and resolves the complaint',async({page})=>{
    await login(page,'ADMIN');await page.getByRole('link',{name:'Complaint queue',exact:true}).click();await page.getByRole('button').filter({has:page.getByRole('heading',{name:complaint})}).click();await page.getByLabel('Response',{exact:true}).fill('Investigating.');await page.getByRole('button',{name:'Update complaint'}).click();await page.getByRole('button').filter({has:page.getByRole('heading',{name:complaint})}).click();await page.getByLabel('Next status').selectOption('resolved');await page.getByLabel('Response',{exact:true}).fill('The projector has been repaired.');await page.getByRole('button',{name:'Update complaint'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
  });
  test('10 · forgotten password receives a neutral confirmation',async({page})=>{await page.goto('/forgot-password');await page.getByLabel('Email address').fill('unknown@example.test');await page.getByRole('button',{name:'Send reset link'}).click();await expect(page.getByRole('status')).toContainText('If this account exists');});
});
