function dxdt = car7dof_ode(t, x, p, road_fn)
% CAR7DOF_ODE  State-space ODE for 7-DOF full car model.
%   x = [z_s; phi; theta; zw1; zw2; zw3; zw4;
%        z_s_dot; phi_dot; theta_dot; zw1_dot; zw2_dot; zw3_dot; zw4_dot]

    % Unpack states
    z_s       = x(1);
    phi       = x(2);
    theta     = x(3);
    z_w       = x(4:7);
    z_s_dot   = x(8);
    phi_dot   = x(9);
    theta_dot = x(10);
    z_w_dot   = x(11:14);

    % Road input at each wheel
    z_r = road_fn(t);

    % Corner positions and velocities
    z_c     = z_s + p.a_vec .* theta + p.b_vec .* phi;
    z_c_dot = z_s_dot + p.a_vec .* theta_dot + p.b_vec .* phi_dot;

    % Suspension forces: F_si = k_si*(z_wi - z_ci) + c_si*(z_wi_dot - z_ci_dot)
    F_s = p.k_s .* (z_w' - z_c) + p.c_s .* (z_w_dot' - z_c_dot);

    % Tire forces: F_ti = k_ti*(z_ri - z_wi)
    F_t = p.k_t .* (z_r - z_w');

    % Accelerations
    z_s_ddot   = sum(F_s) / p.m_s;
    phi_ddot   = sum(p.b_vec .* F_s) / p.I_xx;
    theta_ddot = sum(p.a_vec .* F_s) / p.I_yy;
    z_w_ddot   = (-F_s + F_t)' ./ p.m_w';

    dxdt = [z_s_dot; phi_dot; theta_dot; z_w_dot;
            z_s_ddot; phi_ddot; theta_ddot; z_w_ddot];
end
