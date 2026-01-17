import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl:'./projects.html'
})
export class ProjectsComponent {

  name = '';
  projects: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.get('/projects')
      .subscribe((res:any)=>{
        this.projects = res;
      })
  }

  create() {
    this.api.post('/projects', { name: this.name })
      .subscribe(()=>{
        this.name='';
        this.load();
      })
  }
}
