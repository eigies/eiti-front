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

  describe('avisos diarios', () => {
    function loggedAs(userId: string): AuthService {
      localStorage.setItem('eiti_token', 'token');
      localStorage.setItem('eiti_user', JSON.stringify({ userId, username: 'agus', email: 'a@b.c', token: 'token', refreshToken: 'r', permissions: [] }));
      const service = TestBed.inject(AuthService);
      http.match(() => true).forEach(request => request.flush({}));
      return service;
    }

    it('un aviso sale una vez por día', () => {
      const service = loggedAs('user-a');

      expect(service.isDailyNoticePending('own-cheques')).toBeTrue();
      service.markDailyNoticeSeen('own-cheques');
      expect(service.isDailyNoticePending('own-cheques')).toBeFalse();
    });

    it('al día siguiente vuelve a salir', () => {
      const service = loggedAs('user-a');
      localStorage.setItem('eiti_notice_own-cheques_user-a', '2020-01-01');

      expect(service.isDailyNoticePending('own-cheques')).toBeTrue();
    });

    it('verlo uno no lo apaga para otro usuario del mismo navegador', () => {
      const service = loggedAs('user-a');
      localStorage.setItem('eiti_notice_own-cheques_user-b', new Date().toLocaleDateString('en-CA'));

      expect(service.isDailyNoticePending('own-cheques')).toBeTrue();
    });
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
