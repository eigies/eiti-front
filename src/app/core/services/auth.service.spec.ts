import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OnboardingService } from './onboarding.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{
        provide: OnboardingService,
        useValue: jasmine.createSpyObj('OnboardingService', ['reset'])
      }]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('restaura canViewAllBranches antes de completar el refresh del perfil', () => {
    localStorage.setItem('eiti_token', 'token');
    localStorage.setItem('eiti_user', JSON.stringify({
      userId: 'user-a',
      username: 'agus',
      email: 'agus@example.com',
      token: 'token',
      refreshToken: 'refresh',
      permissions: [],
      canViewAllBranches: true
    }));

    const service = TestBed.inject(AuthService);

    expect(service.currentUser?.canViewAllBranches).toBeTrue();
    http.expectOne(request => request.url.endsWith('/users/me')).flush({
      id: 'user-a',
      username: 'agus',
      email: 'agus@example.com',
      permissions: [],
      branchIds: []
    });
  });
});
