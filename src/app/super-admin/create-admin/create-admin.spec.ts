import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateAdmin } from './create-admin';

describe('CreateAdmin', () => {
  let component: CreateAdmin;
  let fixture: ComponentFixture<CreateAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateAdmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
