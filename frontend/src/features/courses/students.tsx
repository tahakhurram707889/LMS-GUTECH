import { useCourse } from './context';
import { Collection } from '../../components/ui/collection';
import type {Member} from '../../lib/contracts';
export function StudentsPage(){
  const {courseId}=useCourse();
  return <><div className="page-heading"><div><p className="eyebrow">YOUR CLASSROOM</p><h1>Enrolled students</h1><p>Members of your assigned course. Open the gradebook to review academic progress.</p></div></div><Collection<Member> path={courseId?`/courses/${courseId}/members`:null}>{(rows)=><div className="table-scroll"><table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody>{rows.map((member)=><tr key={member.id}><td>{member.fullName}</td><td>{member.role}</td></tr>)}</tbody></table></div>}</Collection></>;
}
