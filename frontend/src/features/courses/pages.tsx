import { useNavigate } from 'react-router-dom';
import { BookOpen,ArrowUpRight } from 'lucide-react';
import type { Course } from '../../lib/contracts';
import { useCourse } from './context';
import { Collection } from '../../components/ui/collection';
export function CoursesPage(){const {select}=useCourse();const navigate=useNavigate();return <><div className="page-heading"><div><p className="eyebrow">YOUR LEARNING PATH</p><h1>Room to grow.</h1><p>Open a course to explore its resources and coursework.</p></div></div>
  <Collection<Course> path="/me/courses">{(courses)=><div className="course-grid">{courses.map((course,i)=><button key={course.id} className={`course-card course-tone-${i%3}`} onClick={()=>{select(course.id);navigate('/resources');}}><div className="course-card-top"><BookOpen size={28}/><ArrowUpRight size={20}/></div><small>{course.code}</small><h2>{course.title}</h2><p>{course.description||'Your course workspace'}</p><span>Open course <ArrowUpRight size={16}/></span></button>)}</div>}</Collection></>;}
